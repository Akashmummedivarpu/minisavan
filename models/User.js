const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true
  },
  phoneNumber: {
    type: String,
    required: true,
    unique: true
  },
  avatar: {
    type: String,
    default: '/avatars/avatar_1_1787246244560.jpg'
  },
  history: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Song'
  }],
  likedSongs: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Song'
  }]
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
