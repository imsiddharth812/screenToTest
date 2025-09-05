const jwt = require('jsonwebtoken')
const { config } = require('../config/config')
const logger = require('../utils/logger')
const { AppError } = require('./errorHandler')

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    logger.warn(`Access attempt without token from IP: ${req.ip}`)
    return next(new AppError('Access token required', 401))
  }

  jwt.verify(token, config.JWT_SECRET, (err, user) => {
    if (err) {
      logger.warn(`JWT verification failed for IP ${req.ip}:`, err.message)
      if (err.name === 'TokenExpiredError') {
        return next(new AppError('Token has expired. Please log in again.', 401))
      }
      if (err.name === 'JsonWebTokenError') {
        return next(new AppError('Invalid token. Please log in again.', 401))
      }
      return next(new AppError('Token verification failed', 401))
    }
    
    logger.debug(`JWT verified successfully for user: ${user.userId}`)
    req.user = user
    next()
  })
}

// Optional authentication middleware (doesn't fail if no token)
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return next() // Continue without user
  }

  jwt.verify(token, config.JWT_SECRET, (err, user) => {
    if (!err) {
      req.user = user
    }
    next() // Continue regardless of token validity
  })
}

// Generate JWT token
const generateToken = (payload) => {
  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN,
    issuer: 'screen2testcases',
    audience: 'screen2testcases-users'
  })
}

// Verify JWT token (for manual verification)
const verifyToken = (token) => {
  try {
    return jwt.verify(token, config.JWT_SECRET)
  } catch (error) {
    throw new AppError('Invalid token', 401)
  }
}

module.exports = {
  authenticateToken,
  optionalAuth,
  generateToken,
  verifyToken
}
