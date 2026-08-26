const express = require('express');
const router = express.Router();
const Playlist = require('../models/Playlist');
const Song = require('../models/Song');
const MusicProvider = require('../services/MusicProvider');
const authMiddleware = require('../middleware/authMiddleware');

// Get all playlists for logged in user
router.get('/', authMiddleware, async (req, res) => {
    try {
        const playlists = await Playlist.find({ user: req.user._id }).populate('tracks');
        res.json(playlists);
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch playlists' });
    }
});

// Get single playlist by ID with tracks populated
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const playlist = await Playlist.findOne({ _id: req.params.id, user: req.user._id }).populate('tracks');
        if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
        res.json(playlist);
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch playlist' });
    }
});

// Create new playlist
router.post('/', authMiddleware, async (req, res) => {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    try {
        const playlist = await Playlist.create({
            name,
            description,
            user: req.user._id,
            tracks: []
        });
        res.status(201).json(playlist);
    } catch (e) {
        res.status(500).json({ error: 'Failed to create playlist' });
    }
});

// Add song to playlist
router.post('/:id/add', authMiddleware, async (req, res) => {
    const { songId } = req.body; // External song ID
    try {
        const playlist = await Playlist.findOne({ _id: req.params.id, user: req.user._id });
        if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

        // Ensure song exists in our DB
        let song = await Song.findOne({ songId });
        if (!song) {
            const songData = await MusicProvider.getSongDetails(songId);
            if (!songData) return res.status(404).json({ error: 'Song details could not be found' });
            
            song = await Song.create({
                songId: songData.id,
                title: songData.title,
                subtitle: songData.subtitle,
                image: songData.image,
                artist: songData.artist,
                source: 'saavn'
            });
        }

        const internalMongoId = song._id;

        if (!playlist.tracks.includes(internalMongoId)) {
            playlist.tracks.push(internalMongoId);
            
            // If it's the first track, set the cover image
            if (playlist.tracks.length === 1 && song.image) {
                playlist.coverImage = song.image;
            }
            await playlist.save();
        }
        res.json(playlist);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to add song to playlist' });
    }
});

// Remove song from playlist
router.post('/:id/remove', authMiddleware, async (req, res) => {
    const { songId } = req.body;
    try {
        const playlist = await Playlist.findOne({ _id: req.params.id, user: req.user._id });
        if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

        playlist.tracks = playlist.tracks.filter(t => t.toString() !== songId);
        
        // Re-evaluate cover image if tracks are removed
        if (playlist.tracks.length === 0) {
            playlist.coverImage = '';
        }
        
        await playlist.save();
        res.json(playlist);
    } catch (e) {
        res.status(500).json({ error: 'Failed to remove song' });
    }
});

// Update playlist
router.put('/:id', authMiddleware, async (req, res) => {
    const { name, description } = req.body;
    try {
        const playlist = await Playlist.findOneAndUpdate(
            { _id: req.params.id, user: req.user._id },
            { name, description },
            { new: true }
        ).populate('tracks');
        if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
        res.json(playlist);
    } catch (e) {
        res.status(500).json({ error: 'Failed to update playlist' });
    }
});

// Delete playlist
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const playlist = await Playlist.findOneAndDelete({ _id: req.params.id, user: req.user._id });
        if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to delete playlist' });
    }
});

module.exports = router;
