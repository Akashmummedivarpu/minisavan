const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'vibesphere-super-secret-key';

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, phoneNumber, avatar } = req.body;
    
    if (!username || !phoneNumber) {
      return res.status(400).json({ error: 'Username and phone number are required' });
    }

    const existingUser = await User.findOne({ phoneNumber });
    if (existingUser) {
      return res.status(400).json({ error: 'Phone number already in use' });
    }

    const user = new User({ username, phoneNumber, avatar });
    await user.save();

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
    
    res.status(201).json({
      token,
      user: { id: user._id, username: user.username, phoneNumber: user.phoneNumber, avatar: user.avatar }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    const user = await User.findOne({ phoneNumber });
    if (!user) {
      return res.status(401).json({ error: 'Phone number not found. Please register.' });
    }

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: { id: user._id, username: user.username, phoneNumber: user.phoneNumber, avatar: user.avatar }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

module.exports = router;
