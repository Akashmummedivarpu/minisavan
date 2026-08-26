const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const Song = require('../models/Song');
const MusicProvider = require('../services/MusicProvider');

// Helper function to upsert a song
async function getOrUpsertSong(songId) {
    let song = await Song.findOne({ songId });
    if (!song) {
        const songData = await MusicProvider.getSongDetails(songId);
        if (!songData) return null;
        
        song = await Song.create({
            songId: songData.id,
            title: songData.title,
            subtitle: songData.subtitle,
            image: songData.image,
            artist: songData.artist,
            source: 'saavn'
        });
    }
    return song;
}

router.get('/history', authMiddleware, async (req, res) => {
    try {
        await req.user.populate('history');
        res.json(req.user.history);
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

router.post('/history', authMiddleware, async (req, res) => {
    const { songId } = req.body;
    try {
        const song = await getOrUpsertSong(songId);
        if (!song) return res.status(404).json({ error: 'Song not found' });

        // Remove from history if it exists to push to front
        const index = req.user.history.indexOf(song._id);
        if (index > -1) {
            req.user.history.splice(index, 1);
        }
        
        req.user.history.unshift(song._id);
        
        // Cap history at 50 songs
        if (req.user.history.length > 50) {
            req.user.history = req.user.history.slice(0, 50);
        }

        await req.user.save();
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to update history' });
    }
});

router.get('/liked', authMiddleware, async (req, res) => {
    try {
        await req.user.populate('likedSongs');
        res.json(req.user.likedSongs);
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch liked songs' });
    }
});

router.post('/liked/toggle', authMiddleware, async (req, res) => {
    const { songId } = req.body;
    try {
        const song = await getOrUpsertSong(songId);
        if (!song) return res.status(404).json({ error: 'Song not found' });

        const index = req.user.likedSongs.indexOf(song._id);
        if (index > -1) {
            req.user.likedSongs.splice(index, 1);
        } else {
            req.user.likedSongs.unshift(song._id);
        }
        
        await req.user.save();
        res.json({ liked: index === -1 });
    } catch (e) {
        res.status(500).json({ error: 'Failed to toggle liked status' });
    }
});

router.put('/profile', authMiddleware, async (req, res) => {
    try {
        const { username, avatar } = req.body;
        if (username) req.user.username = username;
        if (avatar) req.user.avatar = avatar;
        
        await req.user.save();
        res.json({ id: req.user._id, username: req.user.username, phoneNumber: req.user.phoneNumber, avatar: req.user.avatar });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

module.exports = router;
