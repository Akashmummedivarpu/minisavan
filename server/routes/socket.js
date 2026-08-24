const Room = require('../models/Room');
const RoomMember = require('../models/RoomMember');
const RoomPlaybackState = require('../models/RoomPlaybackState');
const RoomQueueItem = require('../models/RoomQueueItem');

module.exports = function(io) {
    io.on('connection', (socket) => {
        console.log('User connected:', socket.id);

        // Helper to validate permission
        const checkPermission = async (userId, roomId, allowedRoles) => {
            const member = await RoomMember.findOne({ userId, roomId, status: 'ACTIVE' });
            if (!member || !allowedRoles.includes(member.role)) return false;
            return member;
        };

        socket.on('room:join', async ({ roomId, userId }, callback) => {
            if (!roomId || !userId) return callback && callback({ error: 'Missing params' });
            
            socket.join(roomId);
            socket.userId = userId;

            // Fetch authoritative state
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
                } else if (member && member.status !== 'ACTIVE' && room.joinMode === 'OPEN_JOIN' && member.status !== 'BANNED') {
                    member.status = 'ACTIVE';
                    await member.save();
                }

                if (!member || member.status !== 'ACTIVE') return callback && callback({ error: 'Not a member' });

                const playbackState = await RoomPlaybackState.findOne({ roomId }).populate('currentTrackId');

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
                    serverTime: Date.now()
                });

                // Notify others
                socket.to(roomId).emit('room:member-joined', { userId });
                if (callback) callback({ success: true });

            } catch(e) {
                console.error("Room sync error", e);
                if (callback) callback({ error: 'Server error' });
            }
        });

        socket.on('room:play', async ({ roomId, positionMs }, callback) => {
            try {
                const member = await checkPermission(socket.userId, roomId, ['ADMIN', 'CONTROLLER']);
                if (!member) return callback && callback({ error: 'Permission denied' });

                const newState = await RoomPlaybackState.findOneAndUpdate(
                    { roomId },
                    { 
                        $set: { 
                            status: 'PLAYING', 
                            positionMs, 
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

                const newState = await RoomPlaybackState.findOneAndUpdate(
                    { roomId },
                    { 
                        $set: { 
                            status: 'PAUSED', 
                            positionMs, 
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

                const newState = await RoomPlaybackState.findOneAndUpdate(
                    { roomId },
                    { 
                        $set: { 
                            positionMs, 
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

        socket.on('room:change-track', async ({ roomId, currentSongId }, callback) => {
            try {
                const member = await checkPermission(socket.userId, roomId, ['ADMIN', 'CONTROLLER']);
                if (!member) return callback && callback({ error: 'Permission denied' });

                const newState = await RoomPlaybackState.findOneAndUpdate(
                    { roomId },
                    { 
                        $set: { 
                            currentTrackId: currentSongId,
                            status: 'PLAYING',
                            positionMs: 0, 
                            stateTimestamp: Date.now(), 
                            updatedBy: socket.userId 
                        },
                        $inc: { sequenceNumber: 1 }
                    },
                    { new: true }
                ).populate('currentTrackId');

                io.to(roomId).emit('room:track-changed', {
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

        // Chat
        socket.on('room:chat', async ({ roomId, message, username }, callback) => {
            try {
                const member = await checkPermission(socket.userId, roomId, ['ADMIN', 'CONTROLLER', 'MEMBER']);
                if (!member) return callback && callback({ error: 'Permission denied' });

                io.to(roomId).emit('room:chat-message', {
                    userId: socket.userId,
                    username,
                    message,
                    createdAt: Date.now()
                });
                if (callback) callback({ success: true });
            } catch(e) {}
        });

        // Reactions
        socket.on('room:reaction', async ({ roomId, emoji, username }, callback) => {
            try {
                const member = await checkPermission(socket.userId, roomId, ['ADMIN', 'CONTROLLER', 'MEMBER']);
                if (!member) return callback && callback({ error: 'Permission denied' });

                io.to(roomId).emit('room:reaction', {
                    userId: socket.userId,
                    username,
                    emoji,
                    timestamp: Date.now()
                });
                if (callback) callback({ success: true });
            } catch(e) {}
        });

        socket.on('room:leave', ({ roomId }) => {
            socket.leave(roomId);
            io.to(roomId).emit('room:member-left', { userId: socket.userId });
        });

        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
        });
    });
};
