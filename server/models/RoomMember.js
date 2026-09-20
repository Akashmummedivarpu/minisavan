const mongoose = require('mongoose');

const roomMemberSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  role: {
    type: String,
    enum: ['ADMIN', 'CONTROLLER', 'MEMBER'],
    default: 'MEMBER'
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'PENDING', 'REMOVED', 'LEFT'],
    default: 'ACTIVE'
  },
  joinedAt: {
    type: Date,
    default: Date.now
  },
  leftAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

// Compound indexes for fast membership lookups
roomMemberSchema.index({ roomId: 1, userId: 1 }, { unique: true });
roomMemberSchema.index({ roomId: 1, status: 1 });
roomMemberSchema.index({ roomId: 1, role: 1 });
roomMemberSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('RoomMember', roomMemberSchema);
