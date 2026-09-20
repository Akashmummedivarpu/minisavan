/**
 * Operational errors that we expect (e.g., Validation, Not Found).
 */
class AppError extends Error {
    constructor(message, statusCode, errorCode = 'INTERNAL_ERROR', isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        this.isOperational = isOperational;
        
        // Capture stack trace, excluding constructor call from it
        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = AppError;
