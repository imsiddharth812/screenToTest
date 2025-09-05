const logger = require('../utils/logger')
const { config } = require('../config/config')

// Custom error class for application-specific errors
class AppError extends Error {
  constructor(message, statusCode) {
    super(message)
    this.statusCode = statusCode
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error'
    this.isOperational = true

    Error.captureStackTrace(this, this.constructor)
  }
}

// Handle database errors
const handleDatabaseError = (err) => {
  if (err.message.includes('UNIQUE constraint failed')) {
    const field = err.message.includes('email') ? 'email' : 'name'
    return new AppError(`${field.charAt(0).toUpperCase() + field.slice(1)} already exists`, 400)
  }
  
  if (err.message.includes('FOREIGN KEY constraint failed')) {
    return new AppError('Invalid reference to related resource', 400)
  }
  
  if (err.message.includes('NOT NULL constraint failed')) {
    const field = err.message.split('.').pop()
    return new AppError(`${field} is required`, 400)
  }
  
  return new AppError('Database operation failed', 500)
}

// Handle JWT errors
const handleJWTError = () => new AppError('Invalid token. Please log in again.', 401)
const handleJWTExpiredError = () => new AppError('Your token has expired. Please log in again.', 401)

// Handle multer errors (file upload)
const handleMulterError = (err) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return new AppError('File too large. Maximum size is 10MB.', 400)
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    return new AppError('Too many files. Maximum is 25 files.', 400)
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return new AppError('Unexpected file field.', 400)
  }
  return new AppError('File upload error', 400)
}

// Send error response in development
const sendErrorDev = (err, req, res) => {
  // Log error details in development
  logger.error('Error details:', {
    error: err,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  })

  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method
  })
}

// Send error response in production
const sendErrorProd = (err, req, res) => {
  // Log error for monitoring
  logger.error('Production error:', {
    message: err.message,
    statusCode: err.statusCode,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    operational: err.isOperational
  })

  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message
    })
  } else {
    // Programming or other unknown error: don't leak error details
    logger.error('Non-operational error:', err)
    
    res.status(500).json({
      status: 'error',
      message: 'Something went wrong! Please try again later.'
    })
  }
}

// Not found handler
const notFound = (req, res, next) => {
  const err = new AppError(`Route ${req.originalUrl} not found`, 404)
  next(err)
}

// Global error handler
const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500
  err.status = err.status || 'error'

  let error = { ...err }
  error.message = err.message

  // Handle specific error types
  if (err.name === 'JsonWebTokenError') error = handleJWTError()
  if (err.name === 'TokenExpiredError') error = handleJWTExpiredError()
  if (err.code?.startsWith('SQLITE_')) error = handleDatabaseError(err)
  if (err.name === 'MulterError') error = handleMulterError(err)

  // Handle validation errors from express-validator
  if (err.name === 'ValidationError' || err.type === 'validation') {
    error = new AppError('Validation failed', 400)
  }

  if (config.NODE_ENV === 'development') {
    sendErrorDev(error, req, res)
  } else {
    sendErrorProd(error, req, res)
  }
}

// Async error wrapper to catch async errors automatically
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next)
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason)
  // Close server gracefully and exit process
  process.exit(1)
})

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err.name, err.message)
  logger.error(err.stack)
  // Exit immediately as the process is in an undefined state
  process.exit(1)
})

module.exports = {
  AppError,
  globalErrorHandler,
  notFound,
  catchAsync
}
