const express = require('express');
const router = express.Router();
const Room = require('../models/Room');
const RoomMember = require('../models/RoomMember');
const RoomPlaybackState = require('../models/RoomPlaybackState');
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
        
        const enrichedRooms = rooms.map(room => ({
            ...room.toObject(),
            memberCount: room.listenerCount || 0
        }));

        res.json(enrichedRooms);
    } catch (e) {
        next(e);
    }
});

// Create a room
router.post('/', authMiddleware, async (req, res, next) => {
    const { name, description, visibility, joinMode } = req.body;
    if (!name) return next(new AppError('Room name required', 400, 'VALIDATION_ERROR'));

    try {
        const room = await Room.create({
            name,
            description: description || '',
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

module.exports = router;
