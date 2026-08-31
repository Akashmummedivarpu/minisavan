require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const http = require('http');

// Route imports
const authRoutes = require('./routes/auth');
const musicRoutes = require('./routes/music');
const userRoutes = require('./routes/user');
const playlistRoutes = require('./routes/playlists');
const roomRoutes = require('./routes/rooms');

const authMiddleware = require('./middleware/authMiddleware');
const logger = require('./utils/logger');
const requestLogger = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // allow all for dev
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Database connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => logger.info('Connected to MongoDB Atlas'))
    .catch(err => logger.error({ err }, 'MongoDB connection error'));

// Optional Auth Middleware for Music Routes (to track history)
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const jwt = require('jsonwebtoken');
            const User = require('./models/User');
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'vibesphere-super-secret-key');
            const user = await User.findById(decoded.id).select('-password');
            if (user) req.user = user;
        }
    } catch (err) {
        // Optional auth fails silently, but we can log at debug level
        logger.debug({ err, requestId: req.id }, 'Optional auth failed');
    }
    next();
};

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api', optionalAuth, musicRoutes);
app.use('/api/user', authMiddleware, userRoutes);
app.use('/api/playlists', authMiddleware, playlistRoutes);
app.use('/api/rooms', roomRoutes);

// Socket.io integration
require('./routes/socket')(io);

// Centralized error handler should be the last middleware
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
});
