const express = require('express')
const path = require('path')
const fs = require('fs')
const multer = require('multer')
const router = express.Router()

// Import services and middleware
const databaseService = require('../services/database')
const { authenticateToken } = require('../middleware/auth')
const { catchAsync } = require('../middleware/errorHandler')
const logger = require('../utils/logger')

// Configure screenshot storage
const screenshotStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../screenshots')
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true })
    }
    cb(null, uploadPath)
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp and random string
    const uniqueSuffix = Date.now() + '-' + Math.random().toString(36).substr(2, 9)
    cb(null, 'screenshot_' + uniqueSuffix + path.extname(file.originalname))
  }
})

const screenshotUpload = multer({ 
  storage: screenshotStorage,
  limits: {
    fileSize: 10485760, // 10MB
    files: 1
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

// Apply authentication to all routes
router.use(authenticateToken)

// Get all scenarios for a feature
router.get('/features/:featureId/scenarios', catchAsync(async (req, res) => {
  const featureId = req.params.featureId
  
  // First verify feature exists and project belongs to user
  const sql = `
    SELECT f.id FROM features f 
    JOIN projects p ON f.project_id = p.id 
    WHERE f.id = ? AND p.user_id = ?
  `
  
  const feature = await databaseService.get(sql, [featureId, req.user.userId])
  
  if (!feature) {
    return res.status(404).json({ error: 'Feature not found' })
  }
  
  const scenarioSql = `
    SELECT s.*, 
           COUNT(DISTINCT sc.id) as screenshot_count
    FROM scenarios s 
    LEFT JOIN screenshots sc ON s.id = sc.scenario_id 
    WHERE s.feature_id = ? 
    GROUP BY s.id 
    ORDER BY s.created_at ASC
  `
  
  const scenarios = await databaseService.all(scenarioSql, [featureId])
  
  // Parse JSON fields for each scenario
  const parsedScenarios = scenarios.map(scenario => ({
    ...scenario,
    test_types: scenario.test_types ? JSON.parse(scenario.test_types) : ['positive', 'negative', 'edge_cases']
  }))
  
  res.json({ scenarios: parsedScenarios })
}))

// Create new scenario
router.post('/features/:featureId/scenarios', catchAsync(async (req, res) => {
  const featureId = req.params.featureId
  const { 
    name, 
    description, 
    testing_intent = 'comprehensive',
    ai_model = 'claude',
    user_story,
    acceptance_criteria,
    business_rules,
    edge_cases,
    test_environment,
    coverage_level = 'comprehensive',
    test_types = ['positive', 'negative', 'edge_cases']
  } = req.body
  
  // Validation
  if (!name || name.trim().length === 0) {
    return res.status(400).json({ error: 'Scenario name is required' })
  }
  
  if (name.length > 150) {
    return res.status(400).json({ error: 'Scenario name must be less than 150 characters' })
  }
  
  // First verify feature exists and project belongs to user
  const sql = `
    SELECT f.id FROM features f 
    JOIN projects p ON f.project_id = p.id 
    WHERE f.id = ? AND p.user_id = ?
  `
  
  const feature = await databaseService.get(sql, [featureId, req.user.userId])
  
  if (!feature) {
    return res.status(404).json({ error: 'Feature not found' })
  }
  
  const insertSql = `INSERT INTO scenarios 
    (feature_id, name, description, testing_intent, ai_model, user_story, acceptance_criteria, 
     business_rules, edge_cases, test_environment, coverage_level, test_types) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  
  const result = await databaseService.run(insertSql, [
    featureId, 
    name.trim(), 
    description?.trim() || null,
    testing_intent,
    ai_model,
    user_story?.trim() || null,
    acceptance_criteria?.trim() || null,
    business_rules?.trim() || null,
    edge_cases?.trim() || null,
    test_environment?.trim() || null,
    coverage_level,
    JSON.stringify(test_types)
  ])
  
  // Return the created scenario
  const scenario = await databaseService.get('SELECT * FROM scenarios WHERE id = ?', [result.lastID])
  
  // Parse JSON fields
  const parsedScenario = {
    ...scenario,
    test_types: scenario.test_types ? JSON.parse(scenario.test_types) : ['positive', 'negative', 'edge_cases']
  }
  
  logger.info(`Scenario created: ${name} (ID: ${result.lastID}) in feature ${featureId} by user ${req.user.userId}`)
  res.status(201).json({ scenario: parsedScenario })
}))

// Update scenario
router.put('/:id', catchAsync(async (req, res) => {
  const scenarioId = req.params.id
  const { 
    name, 
    description, 
    testing_intent,
    ai_model,
    user_story,
    acceptance_criteria,
    business_rules,
    edge_cases,
    test_environment,
    coverage_level,
    test_types
  } = req.body
  
  // Validation
  if (!name || name.trim().length === 0) {
    return res.status(400).json({ error: 'Scenario name is required' })
  }
  
  if (name.length > 150) {
    return res.status(400).json({ error: 'Scenario name must be less than 150 characters' })
  }
  
  // First check if scenario exists and project belongs to user
  const sql = `
    SELECT s.id FROM scenarios s 
    JOIN features f ON s.feature_id = f.id 
    JOIN projects p ON f.project_id = p.id 
    WHERE s.id = ? AND p.user_id = ?
  `
  
  const scenario = await databaseService.get(sql, [scenarioId, req.user.userId])
  
  if (!scenario) {
    return res.status(404).json({ error: 'Scenario not found' })
  }
  
  const updateSql = `UPDATE scenarios SET 
    name = ?, description = ?, testing_intent = ?, ai_model = ?, user_story = ?, acceptance_criteria = ?,
    business_rules = ?, edge_cases = ?, test_environment = ?, coverage_level = ?, 
    test_types = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?`
  
  await databaseService.run(updateSql, [
    name.trim(), 
    description?.trim() || null,
    testing_intent,
    ai_model,
    user_story?.trim() || null,
    acceptance_criteria?.trim() || null,
    business_rules?.trim() || null,
    edge_cases?.trim() || null,
    test_environment?.trim() || null,
    coverage_level,
    test_types ? JSON.stringify(test_types) : null,
    scenarioId
  ])
  
  // Return the updated scenario
  const updatedScenario = await databaseService.get('SELECT * FROM scenarios WHERE id = ?', [scenarioId])
  
  // Parse JSON fields
  const parsedScenario = {
    ...updatedScenario,
    test_types: updatedScenario.test_types ? JSON.parse(updatedScenario.test_types) : ['positive', 'negative', 'edge_cases']
  }
  
  logger.info(`Scenario updated: ${name} (ID: ${scenarioId}) by user ${req.user.userId}`)
  res.json({ scenario: parsedScenario })
}))

// Delete scenario
router.delete('/:id', catchAsync(async (req, res) => {
  const scenarioId = req.params.id
  
  // First check if scenario exists and project belongs to user
  const sql = `
    SELECT s.id FROM scenarios s 
    JOIN features f ON s.feature_id = f.id 
    JOIN projects p ON f.project_id = p.id 
    WHERE s.id = ? AND p.user_id = ?
  `
  
  const scenario = await databaseService.get(sql, [scenarioId, req.user.userId])
  
  if (!scenario) {
    return res.status(404).json({ error: 'Scenario not found' })
  }
  
  // First get all screenshot files for this scenario to clean up from filesystem
  const screenshots = await databaseService.all('SELECT file_path FROM screenshots WHERE scenario_id = ?', [scenarioId])
  
  // Delete scenario (foreign key cascade will delete screenshot records)
  await databaseService.run('DELETE FROM scenarios WHERE id = ?', [scenarioId])
  
  // Clean up screenshot files from filesystem
  screenshots.forEach(screenshot => {
    try {
      const fullPath = path.join(__dirname, '../..', screenshot.file_path)
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath)
        logger.info(`Deleted screenshot file: ${screenshot.file_path}`)
      }
    } catch (fileErr) {
      logger.warn(`Warning: Could not delete screenshot file ${screenshot.file_path}:`, fileErr.message)
    }
  })
  
  logger.info(`Deleted scenario ${scenarioId} and ${screenshots.length} associated screenshot files by user ${req.user.userId}`)
  res.json({ message: 'Scenario deleted successfully' })
}))

// Get screenshots for a scenario  
router.get('/:scenarioId/screenshots', catchAsync(async (req, res) => {
  const scenarioId = req.params.scenarioId
  logger.debug(`📸 GET /api/scenarios/${scenarioId}/screenshots - User ID: ${req.user.userId}`)
  
  // First check if scenario exists and project belongs to user
  const sql = `
    SELECT s.id FROM scenarios s 
    JOIN features f ON s.feature_id = f.id 
    JOIN projects p ON f.project_id = p.id 
    WHERE s.id = ? AND p.user_id = ?
  `
  
  const scenario = await databaseService.get(sql, [scenarioId, req.user.userId])
  
  if (!scenario) {
    logger.warn(`❌ Scenario ${scenarioId} not found for user ${req.user.userId}`)
    return res.status(404).json({ error: 'Scenario not found or access denied' })
  }
  
  logger.debug(`✅ Scenario ${scenarioId} found for user ${req.user.userId}`)
  
  // Get screenshots for the scenario ordered by display order, then by creation time
  const screenshotsSql = 'SELECT * FROM screenshots WHERE scenario_id = ? ORDER BY order_index ASC, created_at ASC'
  const screenshots = await databaseService.all(screenshotsSql, [scenarioId])
  
  logger.debug(`📸 Found ${screenshots.length} screenshots for scenario ${scenarioId}`)
  res.json({ screenshots })
}))

// Get test cases for a scenario  
router.get('/:scenarioId/test-cases', catchAsync(async (req, res) => {
  const { scenarioId } = req.params
  const { analysisType } = req.query // Optional filter by analysis type
  
  // Verify scenario belongs to user
  const sql = `
    SELECT s.*, f.project_id 
    FROM scenarios s
    JOIN features f ON s.feature_id = f.id
    JOIN projects p ON f.project_id = p.id
    WHERE s.id = ? AND p.user_id = ?
  `
  
  const scenario = await databaseService.get(sql, [scenarioId, req.user.userId])
  
  if (!scenario) {
    return res.status(404).json({ error: 'Scenario not found or access denied' })
  }
  
  // Get test cases from database
  let testCasesSql = `
    SELECT * FROM test_cases 
    WHERE scenario_id = ?
  `
  const params = [scenarioId]
  
  if (analysisType) {
    testCasesSql += ` AND analysis_type = ?`
    params.push(analysisType)
  }
  
  testCasesSql += ` ORDER BY updated_at DESC`
  
  const testCases = await databaseService.all(testCasesSql, params)
  
  // Parse and format test cases
  const formattedTestCases = testCases.map(tc => ({
    id: tc.id,
    scenarioId: tc.scenario_id,
    analysisType: tc.analysis_type,
    testCases: JSON.parse(tc.test_case_data),
    totalCount: tc.total_test_cases,
    functionalCount: tc.functional_count,
    endToEndCount: tc.end_to_end_count,
    integrationCount: tc.integration_count,
    uiCount: tc.ui_count,
    createdAt: tc.created_at,
    updatedAt: tc.updated_at
  }))
  
  res.json({ testCases: formattedTestCases, scenario })
}))

// Upload screenshot for a scenario
router.post('/:scenarioId/screenshots', screenshotUpload.single('screenshot'), catchAsync(async (req, res) => {
  const scenarioId = req.params.scenarioId
  const { description } = req.body
  
  if (!req.file) {
    return res.status(400).json({ error: 'No screenshot file uploaded' })
  }
  
  // First check if scenario exists and project belongs to user
  const sql = `
    SELECT s.id FROM scenarios s 
    JOIN features f ON s.feature_id = f.id 
    JOIN projects p ON f.project_id = p.id 
    WHERE s.id = ? AND p.user_id = ?
  `
  
  const scenario = await databaseService.get(sql, [scenarioId, req.user.userId])
  
  if (!scenario) {
    return res.status(404).json({ error: 'Scenario not found' })
  }
  
  // Get the next order_index for this scenario
  const maxOrderResult = await databaseService.get(
    'SELECT COALESCE(MAX(order_index), -1) + 1 as next_order FROM screenshots WHERE scenario_id = ?', 
    [scenarioId]
  )
  
  const nextOrder = maxOrderResult.next_order
  
  // Insert screenshot record with order_index
  const insertSql = `
    INSERT INTO screenshots (scenario_id, filename, original_name, custom_name, file_path, file_size, order_index, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `
  
  const values = [
    scenarioId,
    req.file.filename,
    req.file.originalname,
    description?.trim() || req.file.originalname,
    `screenshots/${req.file.filename}`, // Store relative path instead of absolute
    req.file.size,
    nextOrder
  ]
  
  const result = await databaseService.run(insertSql, values)
  
  // Return the created screenshot
  const screenshot = await databaseService.get('SELECT * FROM screenshots WHERE id = ?', [result.lastID])
  
  logger.info(`Screenshot uploaded: ${req.file.originalname} for scenario ${scenarioId}`)
  res.json({ screenshot })
}))

// Update screenshot description and order (via /api/screenshots/:id route)
router.put('/screenshots/:id', catchAsync(async (req, res) => {
  const screenshotId = req.params.id
  const { description, custom_name, order_index } = req.body
  
  // First check if screenshot exists and project belongs to user
  const sql = `
    SELECT sc.id FROM screenshots sc
    JOIN scenarios s ON sc.scenario_id = s.id 
    JOIN features f ON s.feature_id = f.id 
    JOIN projects p ON f.project_id = p.id 
    WHERE sc.id = ? AND p.user_id = ?
  `
  
  const screenshot = await databaseService.get(sql, [screenshotId, req.user.userId])
  
  if (!screenshot) {
    return res.status(404).json({ error: 'Screenshot not found' })
  }
  
  // Build dynamic update query
  const updateFields = []
  const updateValues = []
  
  if (description !== undefined || custom_name !== undefined) {
    updateFields.push('custom_name = ?')
    updateValues.push((description || custom_name)?.trim() || null)
  }
  
  if (order_index !== undefined) {
    updateFields.push('order_index = ?')
    updateValues.push(order_index)
  }
  
  if (updateFields.length === 0) {
    return res.status(400).json({ error: 'No fields to update' })
  }
  
  updateValues.push(screenshotId)
  const updateSql = `UPDATE screenshots SET ${updateFields.join(', ')} WHERE id = ?`
  
  await databaseService.run(updateSql, updateValues)
  
  // Return the updated screenshot
  const updatedScreenshot = await databaseService.get('SELECT * FROM screenshots WHERE id = ?', [screenshotId])
  
  logger.info(`Screenshot updated: ID ${screenshotId} by user ${req.user.userId}`)
  res.json({ screenshot: updatedScreenshot })
}))

// Delete screenshot (via /api/screenshots/:id route)
router.delete('/screenshots/:id', catchAsync(async (req, res) => {
  const screenshotId = req.params.id
  logger.debug(`Delete screenshot request: ID ${screenshotId} by user ${req.user.userId}`)
  
  // First check if screenshot exists and project belongs to user
  const sql = `
    SELECT sc.id, sc.file_path, sc.filename FROM screenshots sc
    JOIN scenarios s ON sc.scenario_id = s.id 
    JOIN features f ON s.feature_id = f.id 
    JOIN projects p ON f.project_id = p.id 
    WHERE sc.id = ? AND p.user_id = ?
  `
  
  const screenshot = await databaseService.get(sql, [screenshotId, req.user.userId])
  
  if (!screenshot) {
    logger.warn(`Screenshot ${screenshotId} not found for user ${req.user.userId}`)
    return res.status(404).json({ error: 'Screenshot not found or access denied' })
  }
  
  logger.debug(`Deleting screenshot: ${screenshot.filename} (${screenshot.file_path})`)
  
  // Delete screenshot from database first
  await databaseService.run('DELETE FROM screenshots WHERE id = ?', [screenshotId])
  logger.info(`Deleted screenshot record from database: ${screenshot.filename}`)
  
  // Try to delete the physical file
  const fullPath = path.join(__dirname, '../..', screenshot.file_path)
  try {
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath)
      logger.info(`Deleted screenshot file: ${screenshot.filename}`)
    } else {
      logger.warn(`Screenshot file already missing: ${screenshot.filename}`)
    }
  } catch (fileError) {
    logger.error(`Failed to delete screenshot file: ${screenshot.filename}`, fileError)
    // Continue anyway since database record is deleted
  }
  
  res.json({ message: 'Screenshot deleted successfully' })
}))

// Bulk reorder screenshots for a scenario
router.put('/:scenarioId/screenshots/reorder', catchAsync(async (req, res) => {
  const scenarioId = req.params.scenarioId
  const { screenshotIds } = req.body
  
  if (!Array.isArray(screenshotIds)) {
    return res.status(400).json({ error: 'screenshotIds must be an array' })
  }
  
  // Verify scenario belongs to user
  const sql = `
    SELECT s.id FROM scenarios s 
    JOIN features f ON s.feature_id = f.id 
    JOIN projects p ON f.project_id = p.id 
    WHERE s.id = ? AND p.user_id = ?
  `
  
  const scenario = await databaseService.get(sql, [scenarioId, req.user.userId])
  
  if (!scenario) {
    return res.status(404).json({ error: 'Scenario not found' })
  }
  
  // Update order_index for each screenshot
  for (let i = 0; i < screenshotIds.length; i++) {
    await databaseService.run(
      'UPDATE screenshots SET order_index = ? WHERE id = ? AND scenario_id = ?',
      [i, screenshotIds[i], scenarioId]
    )
  }
  
  logger.info(`Reordered ${screenshotIds.length} screenshots for scenario ${scenarioId} by user ${req.user.userId}`)
  res.json({ message: 'Screenshots reordered successfully' })
}))

module.exports = router
