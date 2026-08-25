const mongoose = require('mongoose');

const playlistSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tracks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Song'
  }],
  coverImage: {
    type: String,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('Playlist', playlistSchema);
