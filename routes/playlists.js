const express = require('express');
const router = express.Router();
const Playlist = require('../models/Playlist');
const Song = require('../models/Song');
const MusicProvider = require('../services/MusicProvider');
const authMiddleware = require('../middleware/authMiddleware');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

// Get all playlists for logged in user
router.get('/', authMiddleware, async (req, res, next) => {
    try {
        const playlists = await Playlist.find({ user: req.user._id }).populate('tracks');
        res.json(playlists);
    } catch (e) {
        next(e);
    }
});

// Get single playlist by ID with tracks populated
router.get('/:id', authMiddleware, async (req, res, next) => {
    try {
        const playlist = await Playlist.findOne({ _id: req.params.id, user: req.user._id }).populate('tracks');
        if (!playlist) return next(new AppError('Playlist not found', 404, 'NOT_FOUND'));
        res.json(playlist);
    } catch (e) {
        next(e);
    }
});

// Create new playlist
router.post('/', authMiddleware, async (req, res, next) => {
    const { name, description } = req.body;
    if (!name) return next(new AppError('Name is required', 400, 'VALIDATION_ERROR'));

    try {
        const playlist = await Playlist.create({
            name,
            description,
            user: req.user._id,
            tracks: []
        });
        logger.info({ playlistId: playlist._id, userId: req.user._id, requestId: req.id }, 'PLAYLIST_CREATED');
        res.status(201).json(playlist);
    } catch (e) {
        next(e);
    }
});

// Add song to playlist
router.post('/:id/add', authMiddleware, async (req, res, next) => {
    const { songId } = req.body; // External song ID
    try {
        const playlist = await Playlist.findOne({ _id: req.params.id, user: req.user._id });
        if (!playlist) return next(new AppError('Playlist not found', 404, 'NOT_FOUND'));

        // Ensure song exists in our DB
        let song = await Song.findOne({ songId });
        if (!song) {
            const songData = await MusicProvider.getSongDetails(songId);
            if (!songData) return next(new AppError('Song details could not be found', 404, 'NOT_FOUND'));
            
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
            playlist.trackCount = playlist.tracks.length;
            
            // If it's the first track, set the cover image
            if (playlist.tracks.length === 1 && song.image) {
                playlist.coverImage = song.image;
            }
            await playlist.save();
        }
        res.json(playlist);
    } catch (e) {
        next(e);
    }
});

// Remove song from playlist
router.post('/:id/remove', authMiddleware, async (req, res, next) => {
    const { songId } = req.body;
    try {
        const playlist = await Playlist.findOne({ _id: req.params.id, user: req.user._id });
        if (!playlist) return next(new AppError('Playlist not found', 404, 'NOT_FOUND'));

        // Convert external songId to internal Mongo _id before filtering.
        // The client may pass either the external platform songId OR the internal
        // Mongo ObjectId (populated track._id), so handle both.
        const song = await Song.findOne({ $or: [{ songId }, { _id: songId }] });
        if (song) {
            playlist.tracks = playlist.tracks.filter(t => t.toString() !== song._id.toString());
        } else {
            // Fallback: if songId is already the internal Mongo id representation,
            // remove it directly from the tracks array.
            playlist.tracks = playlist.tracks.filter(t => t.toString() !== songId.toString());
        }
        
        playlist.trackCount = playlist.tracks.length;

        // Re-evaluate cover image if tracks are removed
        if (playlist.tracks.length === 0) {
            playlist.coverImage = '';
        }
        
        await playlist.save();
        res.json(playlist);
    } catch (e) {
        next(e);
    }
});

// Update playlist
router.put('/:id', authMiddleware, async (req, res, next) => {
    const { name, description } = req.body;
    try {
        const playlist = await Playlist.findOneAndUpdate(
            { _id: req.params.id, user: req.user._id },
            { name, description },
            { new: true }
        ).populate('tracks');
        if (!playlist) return next(new AppError('Playlist not found', 404, 'NOT_FOUND'));
        res.json(playlist);
    } catch (e) {
        next(e);
    }
});

// Delete playlist
router.delete('/:id', authMiddleware, async (req, res, next) => {
    try {
        const playlist = await Playlist.findOneAndDelete({ _id: req.params.id, user: req.user._id });
        if (!playlist) return next(new AppError('Playlist not found', 404, 'NOT_FOUND'));
        logger.info({ playlistId: req.params.id, userId: req.user._id, requestId: req.id }, 'PLAYLIST_DELETED');
        res.json({ success: true });
    } catch (e) {
        next(e);
    }
});

module.exports = router;
