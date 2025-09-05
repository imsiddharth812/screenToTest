const winston = require('winston')
const { config } = require('../config/config')

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    if (stack) {
      return `${timestamp} [${level.toUpperCase()}]: ${message}\n${stack}`
    }
    return `${timestamp} [${level.toUpperCase()}]: ${message}`
  })
)

// Create logger instance
const logger = winston.createLogger({
  level: config.NODE_ENV === 'development' ? 'info' : 'info', // Changed from debug to info
  format: logFormat,
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple() // Use simple format for console
      )
    })
  ]
})

// Add file transport for production
if (config.NODE_ENV === 'production') {
  logger.add(new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error'
  }))
  
  logger.add(new winston.transports.File({
    filename: 'logs/combined.log'
  }))
}

// Create a stream for morgan HTTP request logging
logger.stream = {
  write: function(message, encoding) {
    // Use info level so HTTP requests appear in combined.log
    logger.info(message.trim())
  }
}

module.exports = logger
