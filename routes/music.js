const express = require('express');
const router = express.Router();
const MusicProvider = require('../services/MusicProvider');
const Song = require('../models/Song');
const authMiddleware = require('../middleware/authMiddleware');
const optionalAuthMiddleware = require('../middleware/optionalAuthMiddleware');

router.get('/search', async (req, res) => {
    const query = req.query.query;
    if (!query) return res.status(400).json({ error: 'Query parameter is required' });
    
    try {
        const results = await MusicProvider.search(query);
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: 'Search failed' });
    }
});

router.get('/song/:id', optionalAuthMiddleware, async (req, res) => {
    const id = req.params.id;
    const { title, artist, image } = req.query;

    try {
        let cachedSong = await Song.findOne({ songId: id });

        if (id.startsWith('yt_')) {
            const youtubeId = id.replace('yt_', '');
            if (!cachedSong) {
                cachedSong = await Song.create({
                    songId: id,
                    title: title || 'YouTube Audio',
                    artist: artist || '',
                    image: image || '',
                    source: 'youtube',
                    youtubeId: youtubeId
                });
            } else {
                cachedSong.playedAt = Date.now();
                if (title && cachedSong.title === 'YouTube Audio') cachedSong.title = title;
                if (artist && !cachedSong.artist) cachedSong.artist = artist;
                if (image && !cachedSong.image) cachedSong.image = image;
                await cachedSong.save();
            }

            // Update user history if authenticated
            if (req.user) {
                req.user.history = req.user.history.filter(s => s.toString() !== cachedSong._id.toString());
                req.user.history.unshift(cachedSong._id);
                if (req.user.history.length > 50) req.user.history.pop();
                await req.user.save();
            }

            const streamUrl = await MusicProvider.getYoutubeStream(cachedSong.youtubeId);

            return res.json({
                id: cachedSong.songId,
                title: cachedSong.title,
                subtitle: cachedSong.subtitle || '',
                image: cachedSong.image || null,
                streamUrl: streamUrl,
                artist: cachedSong.artist || '',
                youtubeId: cachedSong.youtubeId,
                source: cachedSong.source
            });
        }

        if (id.startsWith('gn_')) {
            const gaanaId = id.replace('gn_', '');
            console.log(`Gaana fallback requested for ${gaanaId}, mapping to YouTube stream...`);
            const song = await Song.findOne({ 'songId': id });
            if (song) {
                if (req.user) {
                    req.user.history = req.user.history.filter(s => s.toString() !== song._id.toString());
                    req.user.history.unshift(song._id);
                    if (req.user.history.length > 50) req.user.history.pop();
                    await req.user.save();
                }

                const ytResults = await ytSearch(`${song.title} ${song.artist}`);
                if (ytResults && ytResults.videos.length > 0) {
                    const topVideo = ytResults.videos[0];
                    const streamUrl = await MusicProvider.getYoutubeStream(topVideo.videoId);
                    if (streamUrl) {
                        return res.json({
                            id: song.songId,
                            title: song.title,
                            image: song.image,
                            streamUrl: streamUrl,
                            artist: song.artist,
                            source: 'gaana-youtube-fallback'
                        });
                    }
                }
            }
            return res.status(404).json({ error: 'Gaana/YouTube stream extraction failed' });
        }

        if (id.startsWith('sc_')) {
            const scId = id.replace('sc_', '');
            if (!cachedSong) {
                cachedSong = await Song.create({
                    songId: id,
                    title: title || 'SoundCloud Audio',
                    artist: artist || '',
                    image: image || '',
                    source: 'soundcloud',
                    scId: scId
                });
            } else {
                cachedSong.playedAt = Date.now();
                if (title && cachedSong.title === 'SoundCloud Audio') cachedSong.title = title;
                if (artist && !cachedSong.artist) cachedSong.artist = artist;
                if (image && !cachedSong.image) cachedSong.image = image;
                await cachedSong.save();
            }

            if (req.user) {
                req.user.history = req.user.history.filter(s => s.toString() !== cachedSong._id.toString());
                req.user.history.unshift(cachedSong._id);
                if (req.user.history.length > 50) req.user.history.pop();
                await req.user.save();
            }

            // For SoundCloud, we passed the URL directly into scId during search mapping
            const streamUrl = await MusicProvider.getSoundCloudStream(cachedSong.scId);

            return res.json({
                id: cachedSong.songId,
                title: cachedSong.title,
                subtitle: cachedSong.subtitle || '',
                image: cachedSong.image || null,
                streamUrl: streamUrl,
                artist: cachedSong.artist || '',
                scId: cachedSong.scId,
                source: cachedSong.source
            });
        }

        if (cachedSong) {
            cachedSong.playedAt = Date.now();
            await cachedSong.save();
            
            if (req.user) {
                req.user.history = req.user.history.filter(s => s.toString() !== cachedSong._id.toString());
                req.user.history.unshift(cachedSong._id);
                if (req.user.history.length > 50) req.user.history.pop();
                await req.user.save();
            }

            const details = await MusicProvider.getSongDetails(id);
            if (details) {
                return res.json({ ...details, id: cachedSong.songId, title: cachedSong.title, artist: cachedSong.artist });
            }
        }

        const songData = await MusicProvider.getSongDetails(id);
        if (songData) {
            const newSong = await Song.create({
                songId: songData.id,
                title: songData.title,
                subtitle: songData.subtitle,
                image: songData.image,
                artist: songData.artist,
                source: 'saavn'
            });

            if (req.user) {
                req.user.history = req.user.history.filter(s => s.toString() !== newSong._id.toString());
                req.user.history.unshift(newSong._id);
                if (req.user.history.length > 50) req.user.history.pop();
                await req.user.save();
            }

            res.json(songData);
        } else {
            res.status(404).json({ error: 'Song not found' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch song details' });
    }
});

router.get('/recommendations', async (req, res) => {
    const { artist, title } = req.query;
    if (!artist && !title) return res.status(400).json({ error: 'Artist or title required' });
    
    try {
        const recommendations = await MusicProvider.getRecommendations(artist, title);
        res.json(recommendations);
    } catch (error) {
        res.status(500).json({ error: 'Recommendations failed' });
    }
});

module.exports = router;
