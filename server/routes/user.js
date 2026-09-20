const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const Song = require('../models/Song');
const MusicProvider = require('../services/MusicProvider');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

// Helper function to upsert a song (race-safe: handles concurrent duplicate creates)
async function getOrUpsertSong(songId) {
    let song = await Song.findOne({ songId });
    if (!song) {
        const songData = await MusicProvider.getSongDetails(songId);
        if (!songData) return null;

        try {
            song = await Song.create({
                songId: songData.id,
                title: songData.title,
                subtitle: songData.subtitle,
                image: songData.image,
                artist: songData.artist,
                source: 'saavn'
            });
        } catch (e) {
            // Handle E11000 duplicate key race (concurrent create for the same song)
            if (e && e.code === 11000) {
                song = await Song.findOne({ songId: songData.id });
                if (!song) throw e;
            } else {
                throw e;
            }
        }
    }
    return song;
}

router.get('/history', authMiddleware, async (req, res, next) => {
    try {
        await req.user.populate('history');
        res.json(req.user.history);
    } catch (e) {
        next(e);
    }
});

router.post('/history', authMiddleware, async (req, res, next) => {
    const { songId } = req.body;
    try {
        const song = await getOrUpsertSong(songId);
        if (!song) return next(new AppError('Song not found', 404, 'NOT_FOUND'));

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
        next(e);
    }
});

router.get('/liked', authMiddleware, async (req, res, next) => {
    try {
        await req.user.populate('likedSongs');
        res.json(req.user.likedSongs);
    } catch (e) {
        next(e);
    }
});

router.post('/liked/toggle', authMiddleware, async (req, res, next) => {
    const { songId } = req.body;
    try {
        const song = await getOrUpsertSong(songId);
        if (!song) return next(new AppError('Song not found', 404, 'NOT_FOUND'));

        const index = req.user.likedSongs.indexOf(song._id);
        if (index > -1) {
            req.user.likedSongs.splice(index, 1);
        } else {
            req.user.likedSongs.unshift(song._id);
        }
        
        await req.user.save();
        res.json({ liked: index === -1 });
    } catch (e) {
        next(e);
    }
});

router.put('/profile', authMiddleware, async (req, res, next) => {
    try {
        const { username, avatar } = req.body;
        if (username) req.user.username = username;
        if (avatar) req.user.avatar = avatar;
        
        await req.user.save();
        
        logger.info({ userId: req.user._id, requestId: req.id }, 'USER_PROFILE_UPDATED');
        
        res.json({ id: req.user._id, username: req.user.username, phoneNumber: req.user.phoneNumber, avatar: req.user.avatar });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
