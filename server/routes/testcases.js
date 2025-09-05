const express = require('express')
const path = require('path')
const fs = require('fs')
const router = express.Router()
const Tesseract = require('tesseract.js')
const ExcelJS = require('exceljs')

// Import services and middleware
const databaseService = require('../services/database')
const { authenticateToken } = require('../middleware/auth')
const { aiLimiter, uploadLimiter } = require('../middleware/security')
const { catchAsync } = require('../middleware/errorHandler')
const logger = require('../utils/logger')
const UnifiedAIService = require('../unifiedAIService')

// Initialize Unified AI Service
const unifiedAIService = new UnifiedAIService()

// Configure multer for file uploads
const multer = require('multer')
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10485760, // 10MB
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

// Store test cases helper function
async function storeTestCases(scenarioId, testCasesData, analysisType = 'unified') {
  const sql = `INSERT INTO test_cases 
    (scenario_id, analysis_type, test_case_data, total_test_cases, functional_count, 
     end_to_end_count, integration_count, ui_count) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  
  const testCaseDataString = JSON.stringify(testCasesData)
  const totalCount = testCasesData.allTestCases?.length || 0
  
  // Count test cases by type
  const functionalCount = testCasesData.allTestCases?.filter(tc => 
    tc.type && tc.type.toLowerCase().includes('functional')
  ).length || 0
  
  const endToEndCount = testCasesData.allTestCases?.filter(tc => 
    tc.type && (tc.type.toLowerCase().includes('end-to-end') || tc.type.toLowerCase().includes('e2e'))
  ).length || 0
  
  const integrationCount = testCasesData.allTestCases?.filter(tc => 
    tc.type && tc.type.toLowerCase().includes('integration')
  ).length || 0
  
  const uiCount = testCasesData.allTestCases?.filter(tc => 
    tc.type && tc.type.toLowerCase().includes('ui')
  ).length || 0
  
  await databaseService.run(sql, [
    scenarioId,
    analysisType,
    testCaseDataString,
    totalCount,
    functionalCount,
    endToEndCount,
    integrationCount,
    uiCount
  ])
}

// Generate test cases endpoint
router.post('/generate-testcases', authenticateToken, aiLimiter, upload.any(), catchAsync(async (req, res) => {
  logger.info('=== START: Processing Unified AI test case generation request ===')
  logger.info('Request authenticated user:', req.user?.userId)
  logger.info('Request body keys:', Object.keys(req.body))
  logger.debug('Request body:', req.body)
  logger.debug('Request files:', req.files?.length || 0, 'files')
  
  try {
    logger.info('Step 1: Parsing request parameters...')
  
    const files = req.files
    
    logger.info('Step 2: Processing screenshotIds...')
    // Handle screenshotIds - can come as string (from FormData) or array
    let screenshotIds = []
    if (req.body.screenshotIds) {
      logger.info('Raw screenshotIds:', req.body.screenshotIds, typeof req.body.screenshotIds)
      if (typeof req.body.screenshotIds === 'string') {
        try {
          screenshotIds = JSON.parse(req.body.screenshotIds)
          logger.info('Parsed screenshotIds:', screenshotIds)
        } catch (error) {
          logger.error('Failed to parse screenshotIds as JSON:', req.body.screenshotIds)
          screenshotIds = []
        }
      } else if (Array.isArray(req.body.screenshotIds)) {
        screenshotIds = req.body.screenshotIds
      }
    }
  
  // Handle both file uploads and existing screenshot IDs
  if ((!files || files.length < 1) && (!screenshotIds || screenshotIds.length < 1)) {
    return res.status(400).json({ error: 'At least 1 image required' })
  }

  // Check total count limit
  const totalCount = (files?.length || 0) + (screenshotIds?.length || 0)
  if (totalCount > 25) {
    return res.status(400).json({ error: 'Maximum 25 images allowed for comprehensive testing' })
  }

  logger.info(`Processing ${totalCount} images with Unified AI...`)
  logger.debug(`- Uploaded files: ${files?.length || 0}`)
  logger.debug(`- Existing screenshots: ${screenshotIds?.length || 0}`)

  // Get page names, scenario ID, and AI model from request
  let pageNames = []
  if (req.body.pageNames) {
    pageNames = typeof req.body.pageNames === 'string' ? JSON.parse(req.body.pageNames) : req.body.pageNames
  }
  const scenarioId = req.body.scenarioId ? parseInt(req.body.scenarioId) : null
  let aiModel = req.body.aiModel || 'claude'
  logger.debug('Page names received:', pageNames)
  logger.debug('Scenario ID received:', scenarioId)
  logger.debug('AI Model from request:', aiModel)

  // Prepare files array combining uploaded files and existing screenshots
  let allFiles = []
  
  // Add uploaded files
  if (files && files.length > 0) {
    // Sort files by originalname to maintain consistent order
    files.sort((a, b) => a.originalname.localeCompare(b.originalname))
    allFiles = [...files]
  }
  
  // Add existing screenshots
  if (screenshotIds && screenshotIds.length > 0) {
    logger.info('Loading existing screenshots:', screenshotIds)
    
    // Load screenshot data from database
    const placeholders = screenshotIds.map(() => '?').join(',')
    const screenshotsSql = `SELECT * FROM screenshots WHERE id IN (${placeholders}) ORDER BY order_index ASC, created_at ASC`
    
    logger.info('Executing database query:', screenshotsSql)
    logger.info('With parameters:', screenshotIds)
    
    const existingScreenshots = await databaseService.all(screenshotsSql, screenshotIds)
    
    logger.info(`Database query completed. Found ${existingScreenshots.length} screenshots`)
    
    logger.info(`Found ${existingScreenshots.length} existing screenshots`)
    
    // Convert existing screenshots to file-like objects
    logger.info('Starting to load screenshot files...')
    for (let i = 0; i < existingScreenshots.length; i++) {
      const screenshot = existingScreenshots[i]
      logger.info(`Processing screenshot ${i + 1}/${existingScreenshots.length}: ID ${screenshot.id}`)
      try {
        // Handle both legacy paths (screenshots/) and server paths (server/screenshots/)
        let filePath = path.join(process.cwd(), screenshot.file_path)
        if (!fs.existsSync(filePath)) {
          // Try the server directory if the root directory doesn't work
          filePath = path.join(process.cwd(), 'server', screenshot.file_path)
        }
        logger.info(`Checking file path: ${filePath}`)
        
        if (fs.existsSync(filePath)) {
          logger.info(`File exists, reading buffer for screenshot ${screenshot.id}`)
          const fileBuffer = fs.readFileSync(filePath)
          logger.info(`Buffer loaded, size: ${fileBuffer.length} bytes`)
          
          allFiles.push({
            originalname: screenshot.custom_name || screenshot.original_name,
            buffer: fileBuffer,
            isExisting: true,
            screenshotId: screenshot.id
          })
          logger.info(`Successfully loaded screenshot: ${screenshot.custom_name || screenshot.original_name}`)
        } else {
          logger.warn(`Screenshot file not found: ${filePath}`)
        }
      } catch (error) {
        logger.error(`Error loading screenshot ${screenshot.id}:`, error)
      }
    }
    logger.info(`Finished loading ${allFiles.length} screenshot files`)
  }

  // Process each image with OCR
  logger.info(`Starting OCR processing for ${allFiles.length} images...`)
  const ocrResults = []
  const screenshotPaths = []
  
  if (allFiles.length === 0) {
    logger.error('No files to process! This will cause the generation to fail.')
    return res.status(400).json({ error: 'No screenshots found to process' })
  }
  
  for (let file of allFiles) {
    try {
      logger.debug(`Processing OCR for: ${file.originalname}`)
      
      // Validate file buffer
      if (!file.buffer || !Buffer.isBuffer(file.buffer)) {
        logger.error(`Invalid buffer for ${file.originalname}`)
        ocrResults.push('')
        screenshotPaths.push(null)
        continue
      }
      
      logger.debug(`File buffer size: ${file.buffer.length} bytes`)
      
      // Process OCR with better error handling
      const { data: { text } } = await Tesseract.recognize(file.buffer, 'eng', {
        logger: m => logger.debug(`OCR Progress for ${file.originalname}:`, m.status)
      })
      ocrResults.push(text.trim())
      
      // Save screenshot to temp location for vision analysis
      const tempPath = path.join(__dirname, '../../temp', `screenshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`)
      
      // Ensure temp directory exists
      const tempDir = path.dirname(tempPath)
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true })
      }
      
      fs.writeFileSync(tempPath, file.buffer)
      screenshotPaths.push(tempPath)
      
      logger.debug(`OCR completed for: ${file.originalname}`)
    } catch (ocrError) {
      logger.error(`OCR failed for ${file.originalname}:`, ocrError)
      ocrResults.push('') // Add empty text for failed OCR
      
      // Still try to save screenshot for vision analysis if buffer exists
      if (file.buffer && Buffer.isBuffer(file.buffer)) {
        try {
          const tempPath = path.join(__dirname, '../../temp', `screenshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`)
          const tempDir = path.dirname(tempPath)
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true })
          }
          fs.writeFileSync(tempPath, file.buffer)
          screenshotPaths.push(tempPath)
        } catch (saveError) {
          logger.error(`Failed to save screenshot for ${file.originalname}:`, saveError)
          screenshotPaths.push(null)
        }
      } else {
        screenshotPaths.push(null)
      }
    }
  }

  logger.info('All OCR processing completed. Generating comprehensive test cases with Unified AI...')

  // Filter out null screenshot paths and adjust arrays accordingly
  const validIndices = []
  const validScreenshotPaths = []
  const validOcrResults = []
  const validPageNames = []

  for (let i = 0; i < screenshotPaths.length; i++) {
    if (screenshotPaths[i] !== null) {
      validIndices.push(i)
      validScreenshotPaths.push(screenshotPaths[i])
      validOcrResults.push(ocrResults[i])
      validPageNames.push(pageNames[i])
    }
  }
  
  logger.info(`Processing ${validScreenshotPaths.length} valid screenshots out of ${screenshotPaths.length} total`)
  
  // Retrieve scenario context if scenarioId is provided
  let scenarioContext = {}
  if (scenarioId) {
    try {
      const scenario = await databaseService.get('SELECT * FROM scenarios WHERE id = ?', [scenarioId])
      
      if (scenario) {
        scenarioContext = {
          testing_intent: scenario.testing_intent,
          coverage_level: scenario.coverage_level,
          test_types: scenario.test_types ? JSON.parse(scenario.test_types) : ['positive', 'negative', 'edge_cases'],
          user_story: scenario.user_story,
          acceptance_criteria: scenario.acceptance_criteria,
          business_rules: scenario.business_rules,
          edge_cases: scenario.edge_cases,
          test_environment: scenario.test_environment
        }
        
        // Use scenario's saved AI model if not provided in request or if default
        if (scenario.ai_model && (req.body.aiModel === 'claude' || !req.body.aiModel)) {
          aiModel = scenario.ai_model
          logger.info(`Using scenario's saved AI model: ${aiModel} (overriding request model)`)
        }
      }
    } catch (error) {
      logger.error('Error retrieving scenario context:', error)
      // Continue with default context if retrieval fails
    }
  }
  
  // Generate test cases using Unified AI service (combines OCR + Vision)
  try {
    logger.info(`Final AI Model selected: ${aiModel}`)
    logger.info(`Using ${aiModel === 'gpt-4-vision' ? 'OpenAI GPT-4 Vision' : 'Claude Anthropic'} for test generation`)
    
    // Check if this is a regeneration request (existing screenshotIds from database)
    const isRegeneration = screenshotIds && screenshotIds.length > 0 && (!files || files.length === 0)
    logger.info(`Request type: ${isRegeneration ? 'Regeneration' : 'New Generation'}`)
    
    console.log('=== BACKEND: TEST CASE GENERATION DEBUG ===');
    console.log('Configuration used for generation:');
    console.log('- AI Model:', aiModel);
    console.log('- Testing Intent:', scenarioContext.testing_intent);
    console.log('- Coverage Level:', scenarioContext.coverage_level);
    console.log('- Test Types:', scenarioContext.test_types);
    console.log('- User Story:', scenarioContext.user_story ? 'Present' : 'Not set');
    console.log('- Acceptance Criteria:', scenarioContext.acceptance_criteria ? 'Present' : 'Not set');
    console.log('- Business Rules:', scenarioContext.business_rules ? 'Present' : 'Not set');
    console.log('- Edge Cases:', scenarioContext.edge_cases ? 'Present' : 'Not set');
    console.log('- Test Environment:', scenarioContext.test_environment ? 'Present' : 'Not set');
    console.log('- Screenshot Count:', validScreenshotPaths.length);
    console.log('============================================');
    
    const testCases = await unifiedAIService.generateTestCases(validScreenshotPaths, validOcrResults, validPageNames, isRegeneration, scenarioContext, aiModel)
    
    if (testCases && testCases.allTestCases && testCases.allTestCases.length > 0) {
      // Store in database with analysis_type as 'unified'
      if (scenarioId) {
        await storeTestCases(scenarioId, testCases, 'unified')
        logger.info(`Unified AI test cases stored in database with scenario ID: ${scenarioId}`)
        logger.info(`Generated ${testCases.allTestCases.length} comprehensive test cases`)
      } else {
        logger.info('No scenario ID provided - test cases not stored in database')
      }
      
      // Clean up temporary screenshot files
      validScreenshotPaths.forEach(tempPath => {
        try {
          if (tempPath && fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath)
          }
        } catch (cleanupError) {
          logger.warn('Failed to cleanup temp file:', tempPath)
        }
      })
      
      // Include configuration information in the response
      const responseData = {
        ...testCases,
        // Configuration metadata for display and regeneration
        configuration: {
          aiModel: aiModel,
          testingIntent: scenarioContext.testing_intent,
          coverageLevel: scenarioContext.coverage_level,
          testTypes: scenarioContext.test_types,
          userStory: scenarioContext.user_story,
          acceptanceCriteria: scenarioContext.acceptance_criteria,
          businessRules: scenarioContext.business_rules,
          edgeCases: scenarioContext.edge_cases,
          testEnvironment: scenarioContext.test_environment,
          screenshotCount: validScreenshotPaths.length,
          scenarioId: scenarioId
        }
      }
      
      logger.info(`Unified AI generated ${testCases.allTestCases.length} comprehensive test cases successfully!`)
      res.json(responseData)
    } else {
      throw new Error('No test cases generated by Unified AI')
    }
  } catch (aiError) {
    logger.error('Unified AI Error details:', aiError)
    logger.error('Error name:', aiError.name)
    logger.error('Error message:', aiError.message)
    logger.error('Error status:', aiError.status)
    logger.error('Error code:', aiError.code)
    logger.error('Full error object:', JSON.stringify(aiError, null, 2))
    
    // Clean up temporary screenshot files on error
    validScreenshotPaths.forEach(tempPath => {
      try {
        if (tempPath && fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath)
        }
      } catch (cleanupError) {
        logger.warn('Failed to cleanup temp file on error:', tempPath)
      }
    })
    
    // Check if it's an API error or parsing error
    if (aiError.message && aiError.message.includes('AI response could not be parsed')) {
      logger.error('Parsing error - attempting to return structured error response')
      return res.status(500).json({ 
        error: 'Comprehensive test case generation failed due to AI response format issues. Please try again.',
        details: 'Unified AI service returned response in unexpected format'
      })
    }
    
    // Check if it's an API key error
    if (aiError.status === 401 || aiError.message.includes('api key') || aiError.message.includes('API key')) {
      logger.error('API key error detected')
      return res.status(500).json({ 
        error: 'AI service authentication failed. Please contact support.',
        details: 'Invalid or missing API key configuration'
      })
    }
    
    // Check if it's an API quota or rate limit error
    if (aiError.status === 529 || aiError.message.includes('overloaded')) {
      logger.warn('Unified AI service overloaded - returning retry message')
      return res.status(503).json({ 
        error: 'Comprehensive AI service is temporarily overloaded. Please wait a moment and try again.',
        _retry: true,
        _retryAfter: 30
      })
    }

    logger.error('Unified AI service failed, returning clear error message')
    res.status(500).json({ 
      error: `Failed to regenerate test cases: ${aiError.message}`,
      details: aiError.message,
      _retry: true,
      _suggestion: 'Our Unified AI analyzes both your screenshots and text content to generate highly comprehensive test cases with maximum coverage.'
    })
  }
  
  } catch (outerError) {
    logger.error('General error in test case generation:', outerError)
    logger.error('Error stack:', outerError.stack)
    res.status(500).json({ 
      error: 'An error occurred during test case generation',
      details: outerError.message
    })
  }
}))

// Download XLSX endpoint
router.post('/download/xlsx', authenticateToken, catchAsync(async (req, res) => {
  const testCases = req.body

  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Test Cases')

  // Add data based on format
  if (testCases.allTestCases) {
    // New detailed format with professional table structure
    worksheet.addRow(['Test Case #', 'Type', 'Title', 'Test Data', 'Test Steps', 'Expected Results'])
    
    testCases.allTestCases.forEach((tc, index) => {
      const testSteps = (tc.testSteps || tc.description || '').replace(/\\n/g, '\n')
      const testData = (tc.testData || 'Standard test data').replace(/\\n/g, '\n')
      const expectedResults = (tc.expectedResults || 'Test should complete successfully').replace(/\\n/g, '\n')
      
      worksheet.addRow([
        `TC-${String(index + 1).padStart(3, '0')}`, 
        tc.type, 
        tc.title, 
        testData,
        testSteps,
        expectedResults
      ])
    })
    
    // Set column widths and formatting
    worksheet.columns = [
      { width: 12 }, // Test Case #
      { width: 15 }, // Type
      { width: 40 }, // Title
      { width: 30 }, // Test Data
      { width: 60 }, // Test Steps
      { width: 40 }  // Expected Results
    ]
    
    // Style the header row
    const headerRow = worksheet.getRow(1)
    headerRow.font = { bold: true, color: { argb: 'FFFFFF' } }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '366092' }
    }
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
    headerRow.height = 25
    
    // Style data rows
    testCases.allTestCases.forEach((tc, index) => {
      const row = worksheet.getRow(index + 2)
      row.alignment = { vertical: 'top', wrapText: true }
      
      // Calculate row height based on content
      const maxLength = Math.max(
        (tc.testSteps || '').length,
        (tc.testData || '').length,
        (tc.expectedResults || '').length
      )
      row.height = Math.max(50, Math.ceil(maxLength / 80) * 20)
      
      // Alternate row colors
      if (index % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'F8F9FA' }
        }
      }
      
      // Style type column
      const typeCell = row.getCell(2)
      typeCell.font = { bold: true, size: 10 }
      typeCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'E3F2FD' }
      }
      typeCell.alignment = { vertical: 'middle', horizontal: 'center' }
      
      // Style title column
      const titleCell = row.getCell(3)
      titleCell.font = { bold: true, size: 10 }
      
      // Style data columns with smaller font
      row.getCell(4).font = { size: 9 } // Test Data
      row.getCell(5).font = { size: 9 } // Test Steps
      row.getCell(6).font = { size: 9 } // Expected Results
      
      // Add borders to all cells
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        }
      })
    })
    
    // Add borders to header row
    headerRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'thick' },
        left: { style: 'thick' },
        bottom: { style: 'thick' },
        right: { style: 'thick' }
      }
    })
    
  } else {
    // Legacy format
    worksheet.addRow(['Category', 'Test Case Description'])
    
    ;(testCases.target || testCases.functional || []).forEach(tc => worksheet.addRow(['Functional', tc]))
    ;(testCases.integration || []).forEach(tc => worksheet.addRow(['Integration', tc]))
    ;(testCases.system || testCases.endToEnd || []).forEach(tc => worksheet.addRow(['End-to-End', tc]))
    ;(testCases.edge || []).forEach(tc => worksheet.addRow(['Edge', tc]))
    ;(testCases.positive || []).forEach(tc => worksheet.addRow(['Positive', tc]))
    ;(testCases.negative || []).forEach(tc => worksheet.addRow(['Negative', tc]))
    
    // Style the header row
    worksheet.getRow(1).font = { bold: true }
    worksheet.columns = [
      { width: 20 },
      { width: 80 }
    ]
  }

  const buffer = await workbook.xlsx.writeBuffer()

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', 'attachment; filename=test-cases.xlsx')
  res.send(buffer)
}))

// Analysis options endpoint - returns unified analysis type
router.get('/analysis-options', (req, res) => {
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

module.exports = router
