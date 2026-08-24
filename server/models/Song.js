const mongoose = require('mongoose');

const songSchema = new mongoose.Schema({
  songId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  title: { 
    type: String, 
    required: true 
  },
  subtitle: { 
    type: String 
  },
  artist: { 
    type: String 
  },
  image: { 
    type: String 
  },
  source: { 
    type: String, 
    enum: ['saavn', 'youtube', 'soundcloud', 'gaana', 'gaana-youtube-fallback'], 
    default: 'saavn' 
  },
  youtubeId: { 
    type: String 
  },
  scId: {
    type: String
  },
  playedAt: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('Song', songSchema);
