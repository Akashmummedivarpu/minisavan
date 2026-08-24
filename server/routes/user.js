const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

router.get('/history', authMiddleware, async (req, res) => {
    try {
        await req.user.populate('history');
        res.json(req.user.history);
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch history' });
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
        const index = req.user.likedSongs.indexOf(songId);
        if (index > -1) {
            req.user.likedSongs.splice(index, 1);
        } else {
            req.user.likedSongs.unshift(songId);
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
