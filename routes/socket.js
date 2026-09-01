const Room = require('../models/Room');
const RoomMember = require('../models/RoomMember');
const RoomPlaybackState = require('../models/RoomPlaybackState');
const RoomQueueItem = require('../models/RoomQueueItem');
const Song = require('../models/Song');
const User = require('../models/User');
const logger = require('../utils/logger');

const ALLOWED_REACTIONS = ['❤️', '🔥', '😂', '😍', '👏', '😮', '🎵', '🎉'];
const GRACE_PERIOD_MS = 60000; // 60 seconds

// Track disconnected users pending grace period
const disconnectTimers = new Map(); // key: `${userId}:${roomId}`, value: timeout

module.exports = function(io) {
    io.on('connection', (socket) => {
        logger.info({ socketId: socket.id }, 'User connected');

        const checkPermission = async (userId, roomId, allowedRoles) => {
            const member = await RoomMember.findOne({ userId, roomId, status: 'ACTIVE' });
            if (!member || !allowedRoles.includes(member.role)) return false;
            return member;
        };

        const updateRoomListenerCount = async (roomId) => {
            try {
                const roomSockets = io.sockets.adapter.rooms.get(roomId);
                const count = roomSockets ? roomSockets.size : 0;
                await Room.findByIdAndUpdate(roomId, { listenerCount: count });
                return count;
            } catch (e) {
                return 0;
            }
        };

        socket.on('room:join', async ({ roomId, userId }, callback) => {
            if (!roomId || !userId) return callback && callback({ error: 'Missing params' });
            
            socket.join(roomId);
            socket.userId = userId;
            socket.currentRoomId = roomId;

            // Cancel any pending disconnect grace period for this user
            const graceKey = `${userId}:${roomId}`;
            if (disconnectTimers.has(graceKey)) {
                clearTimeout(disconnectTimers.get(graceKey));
                disconnectTimers.delete(graceKey);
            }

            try {
                const room = await Room.findById(roomId);
                if (!room) return callback && callback({ error: 'Room not found' });

                let member = await RoomMember.findOne({ userId, roomId });
                
                // Auto-join if OPEN_JOIN and not already a member
                if (!member && room.joinMode === 'OPEN_JOIN') {
                    member = await RoomMember.create({
                        roomId,
                        userId,
                        role: 'MEMBER',
                        status: 'ACTIVE'
                    });
                } else if (member && member.status !== 'ACTIVE' && room.joinMode === 'OPEN_JOIN' && member.status !== 'REMOVED') {
                    member.status = 'ACTIVE';
                    member.leftAt = null;
                    await member.save();
                }

                if (!member || member.status !== 'ACTIVE') return callback && callback({ error: 'Not a member' });

                const playbackState = await RoomPlaybackState.findOne({ roomId }).populate('currentTrackId');

                // Update denormalized listener count
                const listenerCount = await updateRoomListenerCount(roomId);

                // Get active members list
                const members = await RoomMember.find({ roomId, status: 'ACTIVE' })
                    .select('userId role joinedAt')
                    .lean();

                // Get queue items
                const queue = await RoomQueueItem.find({ roomId, status: 'QUEUED' })
                    .sort({ position: 1 })
                    .populate('trackId')
                    .populate('addedBy', 'username')
                    .lean();

                // Send immediate authoritative state
                socket.emit('room:state', {
                    metadata: room,
                    playbackState: {
                        currentSong: playbackState.currentTrackId,
                        status: playbackState.status,
                        positionMs: playbackState.positionMs,
                        stateTimestamp: playbackState.stateTimestamp,
                        sequenceNumber: playbackState.sequenceNumber
                    },
                    role: member.role,
                    serverTime: Date.now(),
                    listenerCount,
                    members,
                    queue: queue.map(q => ({
                        _id: q._id,
                        track: q.trackId,
                        addedBy: q.addedBy,
                        position: q.position
                    }))
                });

                // Notify others
                socket.to(roomId).emit('room:member-joined', { userId, listenerCount });
                if (callback) callback({ success: true });

            } catch(e) {
                logger.error({ err: e, roomId, userId }, "Room sync error");
                if (callback) callback({ error: 'Server error' });
            }
        });

        socket.on('room:play', async ({ roomId, positionMs }, callback) => {
            try {
                const member = await checkPermission(socket.userId, roomId, ['ADMIN', 'CONTROLLER']);
                if (!member) return callback && callback({ error: 'Permission denied' });

                // Server calculates authoritative position from current state
                const currentState = await RoomPlaybackState.findOne({ roomId });
                let authoritativePosition = positionMs;
                if (currentState && currentState.status === 'PLAYING' && currentState.stateTimestamp) {
                    const elapsed = Date.now() - currentState.stateTimestamp;
                    authoritativePosition = currentState.positionMs + elapsed;
                }

                const newState = await RoomPlaybackState.findOneAndUpdate(
                    { roomId },
                    { 
                        $set: { 
                            status: 'PLAYING', 
                            positionMs: authoritativePosition, 
                            stateTimestamp: Date.now(), 
                            updatedBy: socket.userId 
                        },
                        $inc: { sequenceNumber: 1 }
                    },
                    { new: true }
                ).populate('currentTrackId');

                io.to(roomId).emit('room:playback-updated', {
                    currentSong: newState.currentTrackId,
                    status: newState.status,
                    positionMs: newState.positionMs,
                    stateTimestamp: newState.stateTimestamp,
                    sequenceNumber: newState.sequenceNumber
                });

                if (callback) callback({ success: true });
            } catch(e) {
                if (callback) callback({ error: 'Server error' });
            }
        });

        socket.on('room:pause', async ({ roomId, positionMs }, callback) => {
            try {
                const member = await checkPermission(socket.userId, roomId, ['ADMIN', 'CONTROLLER']);
                if (!member) return callback && callback({ error: 'Permission denied' });

                // Server calculates position at the moment of pause
                const currentState = await RoomPlaybackState.findOne({ roomId });
                let authoritativePosition = positionMs;
                if (currentState && currentState.status === 'PLAYING' && currentState.stateTimestamp) {
                    const elapsed = Date.now() - currentState.stateTimestamp;
                    authoritativePosition = currentState.positionMs + elapsed;
                }

                const newState = await RoomPlaybackState.findOneAndUpdate(
                    { roomId },
                    { 
                        $set: { 
                            status: 'PAUSED', 
                            positionMs: authoritativePosition, 
                            stateTimestamp: Date.now(), 
                            updatedBy: socket.userId 
                        },
                        $inc: { sequenceNumber: 1 }
                    },
                    { new: true }
                ).populate('currentTrackId');

                io.to(roomId).emit('room:playback-updated', {
                    currentSong: newState.currentTrackId,
                    status: newState.status,
                    positionMs: newState.positionMs,
                    stateTimestamp: newState.stateTimestamp,
                    sequenceNumber: newState.sequenceNumber
                });

                if (callback) callback({ success: true });
            } catch(e) {
                if (callback) callback({ error: 'Server error' });
            }
        });

        socket.on('room:seek', async ({ roomId, positionMs }, callback) => {
            try {
                const member = await checkPermission(socket.userId, roomId, ['ADMIN', 'CONTROLLER']);
                if (!member) return callback && callback({ error: 'Permission denied' });

                // Validate positionMs is a non-negative number
                const safePosition = Math.max(0, Number(positionMs) || 0);

                const newState = await RoomPlaybackState.findOneAndUpdate(
                    { roomId },
                    { 
                        $set: { 
                            positionMs: safePosition, 
                            stateTimestamp: Date.now(), 
                            updatedBy: socket.userId 
                        },
                        $inc: { sequenceNumber: 1 }
                    },
                    { new: true }
                ).populate('currentTrackId');

                io.to(roomId).emit('room:playback-updated', {
                    currentSong: newState.currentTrackId,
                    status: newState.status,
                    positionMs: newState.positionMs,
                    stateTimestamp: newState.stateTimestamp,
                    sequenceNumber: newState.sequenceNumber
                });

                if (callback) callback({ success: true });
            } catch(e) {
                if (callback) callback({ error: 'Server error' });
            }
        });

        socket.on('room:change-track', async ({ roomId, song }, callback) => {
            try {
                const member = await checkPermission(socket.userId, roomId, ['ADMIN', 'CONTROLLER']);
                if (!member) return callback && callback({ error: 'Permission denied' });

                let trackId = null;
                let trackName = null;
                
                if (song) {
                    const songKey = song.id || song.songId || song._id;
                    if (songKey) {
                        const dbSong = await Song.findOneAndUpdate(
                            { songId: songKey },
                            { 
                                title: song.title || song.name,
                                subtitle: song.subtitle,
                                artist: song.artist,
                                image: song.image,
                                source: song.source || 'saavn',
                                youtubeId: song.youtubeId
                            },
                            { upsert: true, new: true }
                        );
                        trackId = dbSong._id;
                        trackName = dbSong.title;
                    }
                }

                const newState = await RoomPlaybackState.findOneAndUpdate(
                    { roomId },
                    { 
                        $set: { 
                            currentTrackId: trackId,
                            status: song ? 'PLAYING' : 'IDLE',
                            positionMs: 0, 
                            stateTimestamp: Date.now(), 
                            updatedBy: socket.userId 
                        },
                        $inc: { sequenceNumber: 1 }
                    },
                    { new: true }
                ).populate('currentTrackId');

                // Update denormalized track info on Room
                if (trackId) {
                    await Room.findByIdAndUpdate(roomId, {
                        currentTrackId: song?.id || song?.songId || null,
                        currentTrackName: trackName
                    });
                } else {
                    await Room.findByIdAndUpdate(roomId, {
                        currentTrackId: null,
                        currentTrackName: null
                    });
                }

                io.to(roomId).emit('room:track-changed', {
                    currentSong: newState.currentTrackId,
                    status: newState.status,
                    positionMs: newState.positionMs,
                    stateTimestamp: newState.stateTimestamp,
                    sequenceNumber: newState.sequenceNumber
                });

                if (callback) callback({ success: true });
            } catch(e) {
                logger.error({ err: e, roomId, userId: socket.userId }, "Change track error");
                if (callback) callback({ error: 'Server error' });
            }
        });

        // Chat — fetch username from DB to prevent spoofing
        socket.on('room:chat', async ({ roomId, message }, callback) => {
            try {
                if (!message || typeof message !== 'string' || !message.trim()) {
                    return callback && callback({ error: 'Invalid message' });
                }
                if (message.length > 500) {
                    return callback && callback({ error: 'Message too long (max 500 characters)' });
                }
                const member = await checkPermission(socket.userId, roomId, ['ADMIN', 'CONTROLLER', 'MEMBER']);
                if (!member) return callback && callback({ error: 'Permission denied' });

                // Fetch real username from DB
                const user = await User.findById(socket.userId).select('username avatar');
                const username = user ? user.username : 'Unknown';

                io.to(roomId).emit('room:chat-message', {
                    userId: socket.userId,
                    username,
                    avatar: user?.avatar || null,
                    message: message.trim(),
                    createdAt: Date.now()
                });
                if (callback) callback({ success: true });
            } catch(e) {
                logger.error({ err: e, roomId, userId: socket.userId }, "Chat error");
            }
        });

        // Reactions — validate emoji against allowed set
        socket.on('room:reaction', async ({ roomId, emoji }, callback) => {
            try {
                if (!emoji || !ALLOWED_REACTIONS.includes(emoji)) {
                    return callback && callback({ error: 'Invalid emoji' });
                }
                const member = await checkPermission(socket.userId, roomId, ['ADMIN', 'CONTROLLER', 'MEMBER']);
                if (!member) return callback && callback({ error: 'Permission denied' });

                // Fetch real username from DB
                const user = await User.findById(socket.userId).select('username');
                const username = user ? user.username : 'Unknown';

                io.to(roomId).emit('room:reaction', {
                    userId: socket.userId,
                    username,
                    emoji,
                    timestamp: Date.now()
                });
                if (callback) callback({ success: true });
            } catch(e) {
                logger.error({ err: e, roomId, userId: socket.userId }, "Reaction error");
            }
        });

        socket.on('room:leave', async ({ roomId }) => {
            socket.leave(roomId);
            const listenerCount = await updateRoomListenerCount(roomId);
            io.to(roomId).emit('room:member-left', { userId: socket.userId, listenerCount });
            
            // Mark member as LEFT
            if (socket.userId && roomId) {
                await RoomMember.findOneAndUpdate(
                    { userId: socket.userId, roomId, status: 'ACTIVE' },
                    { status: 'LEFT', leftAt: new Date() }
                );
            }
        });

        socket.on('disconnect', async () => {
            logger.info({ socketId: socket.id, userId: socket.userId }, 'User disconnected');
            
            if (socket.currentRoomId && socket.userId) {
                const roomId = socket.currentRoomId;
                const userId = socket.userId;
                const graceKey = `${userId}:${roomId}`;

                // Start 60-second grace period
                const timer = setTimeout(async () => {
                    disconnectTimers.delete(graceKey);
                    try {
                        // Check if user reconnected (socket still in room)
                        const roomSockets = io.sockets.adapter.rooms.get(roomId);
                        if (roomSockets && roomSockets.size > 0) {
                            // User may have reconnected — check if any socket has this userId
                            let reconnected = false;
                            for (const sockId of roomSockets) {
                                const sock = io.sockets.sockets.get(sockId);
                                if (sock && sock.userId === userId) {
                                    reconnected = true;
                                    break;
                                }
                            }
                            if (reconnected) return;
                        }

                        // User did not reconnect — mark as LEFT
                        await RoomMember.findOneAndUpdate(
                            { userId, roomId, status: 'ACTIVE' },
                            { status: 'LEFT', leftAt: new Date() }
                        );

                        // Update denormalized count
                        const listenerCount = await updateRoomListenerCount(roomId);

                        // Broadcast departure
                        io.to(roomId).emit('room:member-left', { userId, listenerCount });

                        // Admin transfer logic
                        const room = await Room.findById(roomId);
                        if (room && room.hostId.toString() === userId) {
                            // Find longest-active Controller
                            let successor = await RoomMember.findOne({
                                roomId, status: 'ACTIVE', role: 'CONTROLLER'
                            }).sort({ joinedAt: 1 });
                            
                            if (!successor) {
                                // Fall back to longest-active Member
                                successor = await RoomMember.findOne({
                                    roomId, status: 'ACTIVE', role: 'MEMBER'
                                }).sort({ joinedAt: 1 });
                            }

                            if (successor) {
                                // Transfer admin
                                await Room.findByIdAndUpdate(roomId, { hostId: successor.userId });
                                await RoomMember.findByIdAndUpdate(successor._id, { role: 'ADMIN' });
                                io.to(roomId).emit('room:admin-transferred', {
                                    newAdminId: successor.userId,
                                    message: 'Host left. Admin transferred.'
                                });
                                logger.info({ roomId, from: userId, to: successor.userId }, 'Admin transferred on leave');
                            } else {
                                // No eligible user — end room
                                room.status = 'ENDED';
                                room.endedAt = new Date();
                                await room.save();
                                io.to(roomId).emit('room:ended', { message: 'Room ended — host left with no eligible successor.' });
                                logger.info({ roomId }, 'Room ended — no eligible admin successor');
                            }
                        }
                    } catch(e) {
                        logger.error({ err: e, roomId, userId }, "Disconnect cleanup error");
                    }
                }, GRACE_PERIOD_MS);

                disconnectTimers.set(graceKey, timer);
            }
        });
    });
};
