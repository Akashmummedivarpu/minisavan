const mongoose = require('mongoose');

const roomQueueItemSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true
  },
  trackId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Song',
    required: true
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  position: {
    type: Number,
    required: true
  }
}, { timestamps: true });

// Indexes
roomQueueItemSchema.index({ roomId: 1, position: 1 });
roomQueueItemSchema.index({ roomId: 1, createdAt: 1 });

module.exports = mongoose.model('RoomQueueItem', roomQueueItemSchema);
