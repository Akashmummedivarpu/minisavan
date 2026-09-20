const mongoose = require('mongoose');

// Persisted room chat messages so history survives rejoin/navigation.
// Live delivery still goes through sockets; this is the durable backfill
// sent with room:state on join (latest N per room).
const roomMessageSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  username: {
    type: String,
    required: true
  },
  avatar: {
    type: String,
    default: null
  },
  message: {
    type: String,
    required: true,
    maxlength: 500
  }
}, { timestamps: { createdAt: true, updatedAt: false } });

roomMessageSchema.index({ roomId: 1, createdAt: -1 });

module.exports = mongoose.model('RoomMessage', roomMessageSchema);
