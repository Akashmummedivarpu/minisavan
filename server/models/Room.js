const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  hostId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  visibility: {
    type: String,
    enum: ['PUBLIC', 'PRIVATE'],
    default: 'PUBLIC'
  },
  joinMode: {
    type: String,
    enum: ['OPEN_JOIN', 'APPROVAL_REQUIRED'],
    default: 'OPEN_JOIN'
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'ENDED'],
    default: 'ACTIVE'
  },
  inviteCode: {
    type: String,
    sparse: true,
    unique: true
  },
  coverImage: {
    type: String,
    default: ''
  }
}, { timestamps: true });

// Indexes
roomSchema.index({ visibility: 1, status: 1 });
roomSchema.index({ hostId: 1 });

module.exports = mongoose.model('Room', roomSchema);
