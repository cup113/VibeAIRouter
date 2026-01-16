const rateLimit = require('express-rate-limit');
const config = require('../config');
const logger = require('../services/logger');

const rateLimitConfig = config.get('rateLimiting');

const ipLimiter = rateLimit({
  windowMs: rateLimitConfig.ip.windowMs,
  max: rateLimitConfig.ip.max,
  message: {
    error: {
      message: rateLimitConfig.ip.message,
      type: 'rate_limit_error',
      code: 'rate_limit_exceeded'
    }
  },
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress;
  },
  handler: (req, res) => {
    logger.warn(`IP rate limit exceeded: ${req.ip}`);
    res.status(429).json({
      error: {
        message: rateLimitConfig.ip.message,
        type: 'rate_limit_error',
        code: 'rate_limit_exceeded'
      }
    });
  },
  skip: (req) => {
    return req.path === '/health';
  }
});

const globalLimiter = rateLimit({
  windowMs: rateLimitConfig.global.windowMs,
  max: rateLimitConfig.global.max,
  message: {
    error: {
      message: rateLimitConfig.global.message,
      type: 'rate_limit_error',
      code: 'rate_limit_exceeded'
    }
  },
  handler: (req, res) => {
    logger.warn('Global rate limit exceeded');
    res.status(429).json({
      error: {
        message: rateLimitConfig.global.message,
        type: 'rate_limit_error',
        code: 'rate_limit_exceeded'
      }
    });
  },
  skip: (req) => {
    return req.path === '/health';
  }
});

module.exports = {
  ipLimiter,
  globalLimiter
};