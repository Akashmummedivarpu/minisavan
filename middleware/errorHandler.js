const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

const errorHandler = (err, req, res, next) => {
    let error = err;

    // Fallback error properties
    error.statusCode = error.statusCode || 500;
    error.errorCode = error.errorCode || 'INTERNAL_ERROR';

    // Mongoose duplicate key error
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        error = new AppError(`Duplicate field value: ${field}. Please use another value.`, 409, 'DUPLICATE_RESOURCE');
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map(val => val.message);
        error = new AppError(`Invalid input data. ${messages.join('. ')}`, 400, 'VALIDATION_ERROR');
    }

    // Mongoose bad ObjectId (CastError)
    if (err.name === 'CastError') {
        error = new AppError(`Invalid ${err.path}: ${err.value}`, 400, 'INVALID_ID');
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        error = new AppError('Invalid token. Please log in again.', 401, 'INVALID_TOKEN');
    }
    if (err.name === 'TokenExpiredError') {
        error = new AppError('Your token has expired. Please log in again.', 401, 'EXPIRED_TOKEN');
    }

    // Logging based on error type
    const errorResponse = {
        success: false,
        errorCode: error.errorCode,
        message: error.isOperational ? error.message : 'Something went wrong',
        requestId: req.id,
        timestamp: new Date().toISOString()
    };

    if (error.isOperational) {
        // Expected operational error (e.g. 404, 400)
        logger.warn({ err: error, requestId: req.id }, `Operational Error: ${error.message}`);
    } else {
        // Unexpected programming or unknown error (500)
        // Log the full technical error object but don't leak it to the client
        logger.error({ err, requestId: req.id }, `UNEXPECTED EXCEPTION: ${err.message}`);
    }

    res.status(error.statusCode).json(errorResponse);
};

module.exports = errorHandler;
