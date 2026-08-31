const pinoHttp = require('pino-http');
const crypto = require('crypto');
const logger = require('../utils/logger');

const requestLogger = pinoHttp({
    logger,
    
    // Generate a Request ID if one isn't provided by the client
    genReqId: function (req, res) {
        const id = req.headers['x-request-id'] || crypto.randomUUID();
        // Return it in the response header
        res.setHeader('X-Request-ID', id);
        req.id = id;
        return id;
    },
    
    // Customize log levels based on response status
    customLogLevel: function (req, res, err) {
        if (res.statusCode >= 500 || err) {
            return 'error';
        } else if (res.statusCode >= 400) {
            return 'warn';
        }
        return 'info';
    },

    // Customize the successful request message
    customSuccessMessage: function (req, res) {
        return `API_REQUEST_COMPLETED ${req.method} ${req.url} - ${res.statusCode}`;
    },

    // Customize the error request message
    customErrorMessage: function (req, res, err) {
        return `API_REQUEST_FAILED ${req.method} ${req.url} - ${res.statusCode}`;
    },

    serializers: {
        req: (req) => ({
            id: req.id,
            method: req.method,
            url: req.url,
            remoteAddress: req.remoteAddress,
            // Only log safe headers, avoid full headers object
            headers: {
                'user-agent': req.headers['user-agent'],
                'x-forwarded-for': req.headers['x-forwarded-for']
            }
        }),
        res: (res) => ({
            statusCode: res.statusCode,
        }),
        err: pinoHttp.stdSerializers.err
    }
});

module.exports = requestLogger;
