const express = require('express');
const router = express.Router();
const MusicProvider = require('../services/MusicProvider');
const Song = require('../models/Song');
const authMiddleware = require('../middleware/authMiddleware');
const optionalAuthMiddleware = require('../middleware/optionalAuthMiddleware');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');
const ytSearch = require('yt-search');

router.get('/search', async (req, res, next) => {
    const query = req.query.query;
    if (!query) return next(new AppError('Query parameter is required', 400, 'VALIDATION_ERROR'));
    
    try {
        const results = await MusicProvider.search(query);
        res.json(results);
    } catch (error) {
        next(error);
    }
});

router.get('/song/:id', optionalAuthMiddleware, async (req, res, next) => {
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
            logger.warn({ gaanaId, requestId: req.id }, `Gaana fallback requested, mapping to YouTube stream...`);
            const song = await Song.findOne({ 'songId': id });
            if (song) {


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
            return next(new AppError('Gaana/YouTube stream extraction failed', 404, 'NOT_FOUND'));
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
            


            const details = await MusicProvider.getSongDetails(id);
            if (details) {
                return res.json({ ...details, id: cachedSong.songId, title: cachedSong.title, artist: cachedSong.artist });
            }
        }

        const songData = await MusicProvider.getSongDetails(id);
        if (songData) {
            let newSong;
            try {
                newSong = await Song.create({
                    songId: songData.id,
                    title: songData.title,
                    subtitle: songData.subtitle,
                    image: songData.image,
                    artist: songData.artist,
                    source: 'saavn'
                });
            } catch (error) {
                // Handle E11000 duplicate key race (concurrent create for the same song)
                if (error && error.code === 11000) {
                    newSong = await Song.findOne({ songId: songData.id });
                } else {
                    throw error;
                }
            }

            res.json(songData);
        } else {
            return next(new AppError('Song not found', 404, 'NOT_FOUND'));
        }
    } catch (error) {
        next(error);
    }
});

router.get('/recommendations', async (req, res, next) => {
    const { artist, title } = req.query;
    if (!artist && !title) return next(new AppError('Artist or title required', 400, 'VALIDATION_ERROR'));
    
    try {
        const recommendations = await MusicProvider.getRecommendations(artist, title);
        res.json(recommendations);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
