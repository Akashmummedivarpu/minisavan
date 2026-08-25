require('dotenv').config();
const mongoose = require('mongoose');
const Song = require('./models/Song');

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    const songs = await Song.find({});
    console.log("Songs in DB:", songs);
    process.exit(0);
  });
