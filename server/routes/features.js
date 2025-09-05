const express = require('express')
const path = require('path')
const fs = require('fs')
const router = express.Router()

// Import services and middleware
const databaseService = require('../services/database')
const { authenticateToken } = require('../middleware/auth')
const { catchAsync } = require('../middleware/errorHandler')
const logger = require('../utils/logger')

// Apply authentication to all routes
router.use(authenticateToken)

// Get all features for a project
router.get('/projects/:projectId/features', catchAsync(async (req, res) => {
  const projectId = req.params.projectId
  
  // First verify project belongs to user
  const project = await databaseService.get('SELECT id FROM projects WHERE id = ? AND user_id = ?', [projectId, req.user.userId])
  
  if (!project) {
    return res.status(404).json({ error: 'Project not found' })
  }
  
  const sql = `
    SELECT f.*, 
           COUNT(DISTINCT s.id) as scenario_count
    FROM features f 
    LEFT JOIN scenarios s ON f.id = s.feature_id 
    WHERE f.project_id = ? 
    GROUP BY f.id 
    ORDER BY f.created_at ASC
  `
  
  const features = await databaseService.all(sql, [projectId])
  res.json({ features })
}))

// Create new feature
router.post('/projects/:projectId/features', catchAsync(async (req, res) => {
  const projectId = req.params.projectId
  const { name, description } = req.body
  
  // Validation
  if (!name || name.trim().length === 0) {
    return res.status(400).json({ error: 'Feature name is required' })
  }
  
  if (name.length > 100) {
    return res.status(400).json({ error: 'Feature name must be less than 100 characters' })
  }
  
  // First verify project belongs to user
  const project = await databaseService.get('SELECT id FROM projects WHERE id = ? AND user_id = ?', [projectId, req.user.userId])
  
  if (!project) {
    return res.status(404).json({ error: 'Project not found' })
  }
  
  const sql = 'INSERT INTO features (project_id, name, description) VALUES (?, ?, ?)'
  const result = await databaseService.run(sql, [projectId, name.trim(), description?.trim() || null])
  
  // Return the created feature
  const feature = await databaseService.get('SELECT * FROM features WHERE id = ?', [result.lastID])
  
  logger.info(`Feature created: ${name} (ID: ${result.lastID}) in project ${projectId} by user ${req.user.userId}`)
  res.status(201).json({ feature })
}))

// Update feature
router.put('/:id', catchAsync(async (req, res) => {
  const featureId = req.params.id
  const { name, description } = req.body
  
  // Validation
  if (!name || name.trim().length === 0) {
    return res.status(400).json({ error: 'Feature name is required' })
  }
  
  if (name.length > 100) {
    return res.status(400).json({ error: 'Feature name must be less than 100 characters' })
  }
  
  // First check if feature exists and project belongs to user
  const sql = `
    SELECT f.id FROM features f 
    JOIN projects p ON f.project_id = p.id 
    WHERE f.id = ? AND p.user_id = ?
  `
  
  const feature = await databaseService.get(sql, [featureId, req.user.userId])
  
  if (!feature) {
    return res.status(404).json({ error: 'Feature not found' })
  }
  
  const updateSql = 'UPDATE features SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  await databaseService.run(updateSql, [name.trim(), description?.trim() || null, featureId])
  
  // Return the updated feature
  const updatedFeature = await databaseService.get('SELECT * FROM features WHERE id = ?', [featureId])
  
  logger.info(`Feature updated: ${name} (ID: ${featureId}) by user ${req.user.userId}`)
  res.json({ feature: updatedFeature })
}))

// Delete feature
router.delete('/:id', catchAsync(async (req, res) => {
  const featureId = req.params.id
  
  // First check if feature exists and project belongs to user
  const sql = `
    SELECT f.id FROM features f 
    JOIN projects p ON f.project_id = p.id 
    WHERE f.id = ? AND p.user_id = ?
  `
  
  const feature = await databaseService.get(sql, [featureId, req.user.userId])
  
  if (!feature) {
    return res.status(404).json({ error: 'Feature not found' })
  }
  
  // Get all screenshot files for this feature before deletion
  const screenshotsSql = `
    SELECT sc.file_path 
    FROM screenshots sc
    JOIN scenarios s ON sc.scenario_id = s.id
    WHERE s.feature_id = ?
  `
  
  const screenshots = await databaseService.all(screenshotsSql, [featureId])
  
  // Delete feature (cascading will handle scenarios and screenshot records)
  await databaseService.run('DELETE FROM features WHERE id = ?', [featureId])
  
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
  
  logger.info(`Deleted feature ${featureId} and ${screenshots.length} associated screenshot files by user ${req.user.userId}`)
  res.json({ message: 'Feature deleted successfully' })
}))


module.exports = router
