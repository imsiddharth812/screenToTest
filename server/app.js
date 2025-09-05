// Import required modules
require('express-async-errors') // Must be imported before other modules
const express = require('express')
const cors = require('cors')
const multer = require('multer')
const path = require('path')

// Import configuration and utilities
const { config, validateConfig } = require('./config/config')
const logger = require('./utils/logger')

// Import middleware
const { securityHeaders, generalLimiter, uploadLimiter, aiLimiter } = require('./middleware/security')
const { globalErrorHandler, notFound } = require('./middleware/errorHandler')
const { authenticateToken } = require('./middleware/auth')

// Import services
const databaseService = require('./services/database')
const fileService = require('./services/fileService')

// Import routes
const authRoutes = require('./routes/auth')
const projectRoutes = require('./routes/projects')
const featureRoutes = require('./routes/features')
const scenarioRoutes = require('./routes/scenarios')
const testcaseRoutes = require('./routes/testcases')

// Import legacy functionality (will be modularized)
const UnifiedAIService = require('./unifiedAIService')
const { catchAsync } = require('./middleware/errorHandler')

// Validate configuration at startup
validateConfig()

// Initialize express app
const app = express()

// Initialize services
let unifiedAIService
let db // For backward compatibility during transition

async function initializeServices() {
  try {
    // Initialize database
    await databaseService.initialize()
    db = databaseService.getDatabase() // For backward compatibility
    
    // Initialize file service
    await fileService.initializeDirectories()
    
    // Initialize AI service
    unifiedAIService = new UnifiedAIService()
    
    // Run cleanup tasks
    await performStartupCleanup()
    
    logger.info('All services initialized successfully')
  } catch (error) {
    logger.error('Service initialization failed:', error)
    process.exit(1)
  }
}

// Startup cleanup tasks
async function performStartupCleanup() {
  try {
    // Cleanup temporary files
    const cleanedTemp = await fileService.cleanupTempFiles()
    if (cleanedTemp > 0) {
      logger.info(`Cleaned up ${cleanedTemp} temporary files on startup`)
    }
    
    // Cleanup orphaned files
    const screenshots = await databaseService.all('SELECT filename FROM screenshots')
    const validFilenames = screenshots.map(s => s.filename)
    const cleanedOrphans = await fileService.cleanupOrphanedFiles(validFilenames)
    
    logger.info('Startup cleanup completed')
  } catch (error) {
    logger.error('Startup cleanup failed:', error)
  }
}

// Security middleware
app.use(securityHeaders)
app.use(generalLimiter)

// Basic middleware
app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// Trust proxy for accurate IP addresses in rate limiting
app.set('trust proxy', 1)

// Serve static files from screenshots directory
app.use('/screenshots', express.static(path.join(__dirname, 'screenshots')))

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/projects', projectRoutes)
app.use('/api', featureRoutes)
app.use('/api', scenarioRoutes) // For /features/:id/scenarios
app.use('/api/scenarios', scenarioRoutes) // For /scenarios/:id/screenshots  
app.use('/api', scenarioRoutes) // For /screenshots/:id operations
app.use('/api', testcaseRoutes)

// Health check route (no authentication required)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  })
})

// DEBUG: Environment check endpoint (remove in production)
app.get('/api/debug/env', (req, res) => {
  res.json({
    hasApiKey: !!config.ANTHROPIC_API_KEY,
    keyLength: config.ANTHROPIC_API_KEY ? config.ANTHROPIC_API_KEY.length : 0,
    keyPrefix: config.ANTHROPIC_API_KEY ? config.ANTHROPIC_API_KEY.substring(0, 10) + '...' : 'NOT SET',
    nodeEnv: config.NODE_ENV,
    port: config.PORT,
    databaseUrl: config.DATABASE_URL
  })
})

// Protected screenshot serving - users can only access their own screenshots
app.get('/api/screenshots/:screenshotId', authenticateToken, catchAsync(async (req, res) => {
  const screenshotId = req.params.screenshotId
  
  // Verify screenshot exists and user has access to it
  const sql = `
    SELECT sc.file_path, sc.original_name 
    FROM screenshots sc
    JOIN scenarios s ON sc.scenario_id = s.id
    JOIN features f ON s.feature_id = f.id
    JOIN projects p ON f.project_id = p.id
    WHERE sc.id = ? AND p.user_id = ?
  `
  
  const screenshot = await databaseService.get(sql, [screenshotId, req.user.userId])
  
  if (!screenshot) {
    return res.status(404).json({ error: 'Screenshot not found or access denied' })
  }
  
  // Construct full file path
  const filePath = path.join(__dirname, screenshot.file_path)
  
  // Check if file exists
  const fileExists = await fileService.fileExists(filePath)
  if (!fileExists) {
    logger.error(`Screenshot file not found: ${filePath}`)
    return res.status(404).json({ error: 'Screenshot file not found' })
  }
  
  // Set proper headers
  res.setHeader('Content-Type', 'image/png')
  res.setHeader('Cache-Control', 'private, max-age=3600') // Cache for 1 hour
  res.setHeader('Content-Disposition', `inline; filename="${screenshot.original_name}"`)
  
  // Serve the file securely
  res.sendFile(path.resolve(filePath))
}))

// Configure multer for file uploads with security
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.UPLOAD_MAX_SIZE,
    files: 25
  },
  fileFilter: (req, file, cb) => {
    // Only allow image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('Only image files are allowed'), false)
    }
  }
})

// TODO: Add other route modules here as they are extracted from the legacy server
// This is a transition file - routes will be added incrementally

// Analysis options endpoint
app.get('/api/analysis-options', (req, res) => {
  res.json({
    unified: true,
    analysis: {
      id: 'unified',
      name: 'Unified AI Analysis',
      description: 'Advanced comprehensive analysis combining OCR text extraction and AI vision analysis for maximum test coverage and accuracy',
      features: [
        'Complete coverage (90-95%)', 
        'OCR text analysis + Visual AI analysis', 
        'Intelligent test case generation (20-25 test cases)',
        'Business logic validation',
        'Cross-module integration testing',
        'End-to-end workflow testing',
        'Maximum accuracy and detail'
      ],
      processingTime: 'Optimized (60-90 seconds)',
      coverage: '90-95% feature coverage'
    }
  })
})

// Manual integrity check endpoint (protected)
app.post('/api/admin/integrity-check', authenticateToken, catchAsync(async (req, res) => {
  logger.info(`Manual integrity check triggered by user ${req.user.userId}`)
  
  // Run integrity check
  const screenshots = await databaseService.all('SELECT filename FROM screenshots')
  const validFilenames = screenshots.map(s => s.filename)
  const cleanedCount = await fileService.cleanupOrphanedFiles(validFilenames)
  
  res.json({ 
    message: 'Database integrity check completed',
    timestamp: new Date().toISOString(),
    filesCleanedUp: cleanedCount,
    note: 'Check server logs for detailed results'
  })
}))

// Not found handler
app.use(notFound)

// Global error handler (must be last)
app.use(globalErrorHandler)

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received, shutting down gracefully...`)
  
  if (databaseService) {
    await databaseService.close()
  }
  
  process.exit(0)
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

// Schedule cleanup tasks
setInterval(async () => {
  try {
    logger.debug('Running scheduled cleanup tasks...')
    await fileService.cleanupTempFiles()
    
    // Weekly orphaned files cleanup
    if (new Date().getDay() === 0) { // Sunday
      const screenshots = await databaseService.all('SELECT filename FROM screenshots')
      const validFilenames = screenshots.map(s => s.filename)
      await fileService.cleanupOrphanedFiles(validFilenames)
    }
  } catch (error) {
    logger.error('Scheduled cleanup failed:', error)
  }
}, 3600000) // Run every hour

// Start server
async function startServer() {
  try {
    await initializeServices()
    
    app.listen(config.PORT, () => {
      logger.info(`Server running on port ${config.PORT}`)
      logger.info(`Environment: ${config.NODE_ENV}`)
      logger.info(`Database: ${config.DATABASE_URL}`)
      logger.info('🔒 Security: Enhanced security measures active')
      logger.info('📋 Monitoring: Comprehensive logging enabled')
      logger.info('🧹 Cleanup: Automated cleanup tasks scheduled')
      logger.info('✅ Server ready to accept connections')
    })
  } catch (error) {
    logger.error('Failed to start server:', error)
    process.exit(1)
  }
}

// Export for testing
module.exports = app

// Start server if this file is run directly
if (require.main === module) {
  startServer()
}
