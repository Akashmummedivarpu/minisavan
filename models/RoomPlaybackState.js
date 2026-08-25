const mongoose = require('mongoose');

const roomPlaybackStateSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true,
    unique: true
  },
  currentTrackId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Song',
    default: null
  },
  status: {
    type: String,
    enum: ['PLAYING', 'PAUSED'],
    default: 'PAUSED'
  },
  positionMs: {
    type: Number,
    default: 0
  },
  stateTimestamp: {
    type: Number,
    default: Date.now
  },
  sequenceNumber: {
    type: Number,
    default: 0
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('RoomPlaybackState', roomPlaybackStateSchema);
