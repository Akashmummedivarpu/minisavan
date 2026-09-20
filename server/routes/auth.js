const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'vibesphere-super-secret-key';

// Register
router.post('/register', async (req, res, next) => {
  try {
    const { username, phoneNumber, avatar } = req.body;
    
    if (!username || !phoneNumber) {
      return next(new AppError('Username and phone number are required', 400, 'VALIDATION_ERROR'));
    }

    const existingUser = await User.findOne({ phoneNumber });
    if (existingUser) {
      return next(new AppError('Phone number already in use', 409, 'DUPLICATE_RESOURCE'));
    }

    const user = new User({ username, phoneNumber, avatar });
    await user.save();

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
    
    logger.info({ userId: user._id, requestId: req.id }, 'USER_REGISTRATION_SUCCESS');

    res.status(201).json({
      token,
      user: { id: user._id, username: user.username, phoneNumber: user.phoneNumber, avatar: user.avatar }
    });
  } catch (error) {
    next(error);
  }
});

// Login
router.post('/login', async (req, res, next) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return next(new AppError('Phone number is required', 400, 'VALIDATION_ERROR'));
    }

    const user = await User.findOne({ phoneNumber });
    if (!user) {
      logger.warn({ phoneNumber, requestId: req.id }, 'LOGIN_FAILED: Phone number not found');
      return next(new AppError('Phone number not found. Please register.', 401, 'UNAUTHORIZED'));
    }

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });

    logger.info({ userId: user._id, requestId: req.id }, 'LOGIN_SUCCESS');

    res.json({
      token,
      user: { id: user._id, username: user.username, phoneNumber: user.phoneNumber, avatar: user.avatar }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
