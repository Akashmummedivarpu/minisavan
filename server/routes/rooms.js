const express = require('express');
const router = express.Router();
const Room = require('../models/Room');
const RoomMember = require('../models/RoomMember');
const RoomPlaybackState = require('../models/RoomPlaybackState');
const RoomQueueItem = require('../models/RoomQueueItem');
const RoomMessage = require('../models/RoomMessage');
const authMiddleware = require('../middleware/authMiddleware');
const crypto = require('crypto');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

// Helper to generate invite code
const generateInviteCode = () => crypto.randomBytes(3).toString('hex').toUpperCase();

// List public rooms
router.get('/', async (req, res, next) => {
    try {
        const rooms = await Room.find({ status: 'ACTIVE', visibility: 'PUBLIC' })
            .populate('hostId', 'username');

        const roomIds = rooms.map(room => room._id);

        // Fetch playback states so the client can tell which rooms are actually
        // playing a song right now (used by Home to show "Active Rooms").
        const playbackStates = roomIds.length > 0
            ? await RoomPlaybackState.find({ roomId: { $in: roomIds } }).select('roomId status currentTrackId positionMs').lean()
            : [];
        const playbackMap = new Map(playbackStates.map(s => [s.roomId.toString(), s]));

        const enrichedRooms = rooms.map(room => {
            const pb = playbackMap.get(room._id.toString());
            const isPlaying = !!(pb && pb.status === 'PLAYING' && pb.currentTrackId);
            return {
                ...room.toObject(),
                memberCount: room.listenerCount || 0,
                isPlaying,
                isPaused: !!(pb && pb.status === 'PAUSED' && pb.currentTrackId)
            };
        });

        res.json(enrichedRooms);
    } catch (e) {
        next(e);
    }
});

// Create a room
// Resolve an invite code to a room (join-by-code flow)
router.get('/join/:inviteCode', authMiddleware, async (req, res, next) => {
    try {
        const code = (req.params.inviteCode || '').toUpperCase().trim();
        const room = await Room.findOne({ inviteCode: code, status: 'ACTIVE' }).select('_id name visibility');
        if (!room) return next(new AppError('Invalid or expired invite code', 404, 'NOT_FOUND'));
        res.json({ roomId: room._id, name: room.name, visibility: room.visibility });
    } catch (e) {
        next(e);
    }
});

router.post('/', authMiddleware, async (req, res, next) => {
    const { name, description, visibility, joinMode, coverImage } = req.body;
    if (!name) return next(new AppError('Room name required', 400, 'VALIDATION_ERROR'));

    try {
        const room = await Room.create({
            name,
            description: description || '',
            coverImage: coverImage || '',
            hostId: req.user._id,
            visibility: visibility || 'PUBLIC',
            joinMode: joinMode || 'OPEN_JOIN',
            inviteCode: generateInviteCode()
        });

        // Add creator as ADMIN member
        await RoomMember.create({
            roomId: room._id,
            userId: req.user._id,
            role: 'ADMIN',
            status: 'ACTIVE'
        });

        // Initialize empty playback state
        await RoomPlaybackState.create({
            roomId: room._id,
            status: 'PAUSED',
            positionMs: 0,
            updatedBy: req.user._id
        });

        logger.info({ roomId: room._id, userId: req.user._id, requestId: req.id }, 'ROOM_CREATED');

        res.status(201).json(room);
    } catch (e) {
        next(e);
    }
});

// Delete a room (host only) — notifies members, then wipes all room data
router.delete('/:id', authMiddleware, async (req, res, next) => {
    try {
        const room = await Room.findById(req.params.id);
        if (!room) return next(new AppError('Room not found', 404, 'NOT_FOUND'));
        if (room.hostId.toString() !== req.user._id.toString()) {
            return next(new AppError('Only the host can delete this room', 403, 'FORBIDDEN'));
        }

        const roomId = room._id;
        const io = req.app.get('io');
        if (io) {
            io.to(roomId.toString()).emit('room:ended', { message: 'Room deleted by the host.' });
        }

        await Promise.all([
            RoomMember.deleteMany({ roomId }),
            RoomPlaybackState.deleteMany({ roomId }),
            RoomQueueItem.deleteMany({ roomId }),
            RoomMessage.deleteMany({ roomId }),
            Room.deleteOne({ _id: roomId })
        ]);

        logger.info({ roomId, userId: req.user._id, requestId: req.id }, 'ROOM_DELETED');
        res.json({ success: true });
    } catch (e) {
        next(e);
    }
});

module.exports = router;
