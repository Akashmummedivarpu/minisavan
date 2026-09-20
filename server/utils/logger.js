const pino = require('pino');

const isProduction = process.env.NODE_ENV === 'production';

// Centralized Pino Logger
const logger = pino({
    level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
    // Redact sensitive paths to avoid accidental logging of credentials, tokens, etc.
    redact: {
        paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.body.password',
            'req.body.token',
            'user.password',
            'token',
            'accessToken',
            'refreshToken'
        ],
        censor: '[REDACTED]'
    },
    // Optional: pretty print in development for easier reading
    ...(!isProduction && {
        transport: {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname'
            }
        }
    })
});

module.exports = logger;
