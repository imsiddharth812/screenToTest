const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const { config } = require('../config/config')
const logger = require('../utils/logger')

// Security headers middleware
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false, // Required for certain image processing
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
})

// General rate limiting
const generalLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil(config.RATE_LIMIT_WINDOW_MS / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`)
    res.status(options.statusCode).json(options.message)
  }
})

// Strict rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_ATTEMPTS,
  message: {
    error: 'Too many authentication attempts from this IP, please try again later.',
    retryAfter: Math.ceil(config.RATE_LIMIT_WINDOW_MS / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  handler: (req, res, next, options) => {
    logger.warn(`Auth rate limit exceeded for IP: ${req.ip}`)
    res.status(options.statusCode).json(options.message)
  }
})

// File upload rate limiting
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 file uploads per minute
  message: {
    error: 'Too many file uploads from this IP, please try again later.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logger.warn(`Upload rate limit exceeded for IP: ${req.ip}`)
    res.status(options.statusCode).json(options.message)
  }
})

// AI service rate limiting
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // Limit each IP to 5 AI requests per minute
  message: {
    error: 'Too many AI service requests from this IP, please try again later.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logger.warn(`AI service rate limit exceeded for IP: ${req.ip}`)
    res.status(options.statusCode).json(options.message)
  }
})

module.exports = {
  securityHeaders,
  generalLimiter,
  authLimiter,
  uploadLimiter,
  aiLimiter
}
