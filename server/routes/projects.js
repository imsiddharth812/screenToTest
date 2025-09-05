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

// Get all projects for authenticated user
router.get('/', catchAsync(async (req, res) => {
  const sql = `
    SELECT p.*, 
           COUNT(DISTINCT f.id) as feature_count,
           COUNT(DISTINCT s.id) as scenario_count
    FROM projects p 
    LEFT JOIN features f ON p.id = f.project_id 
    LEFT JOIN scenarios s ON f.id = s.feature_id 
    WHERE p.user_id = ? 
    GROUP BY p.id 
    ORDER BY p.updated_at DESC
  `
  
  const projects = await databaseService.all(sql, [req.user.userId])
  res.json({ projects })
}))

// Create new project
router.post('/', catchAsync(async (req, res) => {
  const { name, description } = req.body
  
  // Validation
  if (!name || name.trim().length === 0) {
    return res.status(400).json({ error: 'Project name is required' })
  }
  
  if (name.length > 100) {
    return res.status(400).json({ error: 'Project name must be less than 100 characters' })
  }
  
  if (description && description.length > 500) {
    return res.status(400).json({ error: 'Project description must be less than 500 characters' })
  }
  
  const sql = 'INSERT INTO projects (user_id, name, description) VALUES (?, ?, ?)'
  const result = await databaseService.run(sql, [req.user.userId, name.trim(), description?.trim() || null])
  
  // Return the created project
  const project = await databaseService.get('SELECT * FROM projects WHERE id = ?', [result.lastID])
  
  logger.info(`Project created: ${name} (ID: ${result.lastID}) by user ${req.user.userId}`)
  res.status(201).json({ project })
}))

// Update project
router.put('/:id', catchAsync(async (req, res) => {
  const projectId = req.params.id
  const { name, description } = req.body
  
  // Validation
  if (!name || name.trim().length === 0) {
    return res.status(400).json({ error: 'Project name is required' })
  }
  
  if (name.length > 100) {
    return res.status(400).json({ error: 'Project name must be less than 100 characters' })
  }
  
  if (description && description.length > 500) {
    return res.status(400).json({ error: 'Project description must be less than 500 characters' })
  }
  
  // First check if project exists and belongs to user
  const project = await databaseService.get('SELECT id FROM projects WHERE id = ? AND user_id = ?', [projectId, req.user.userId])
  
  if (!project) {
    return res.status(404).json({ error: 'Project not found' })
  }
  
  const sql = 'UPDATE projects SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  await databaseService.run(sql, [name.trim(), description?.trim() || null, projectId])
  
  // Return the updated project
  const updatedProject = await databaseService.get('SELECT * FROM projects WHERE id = ?', [projectId])
  
  logger.info(`Project updated: ${name} (ID: ${projectId}) by user ${req.user.userId}`)
  res.json({ project: updatedProject })
}))

// Delete project
router.delete('/:id', catchAsync(async (req, res) => {
  const projectId = req.params.id
  
  // First check if project exists and belongs to user
  const project = await databaseService.get('SELECT id FROM projects WHERE id = ? AND user_id = ?', [projectId, req.user.userId])
  
  if (!project) {
    return res.status(404).json({ error: 'Project not found' })
  }
  
  // Get all screenshot files for this project before deletion
  const screenshotsSql = `
    SELECT sc.file_path 
    FROM screenshots sc
    JOIN scenarios s ON sc.scenario_id = s.id
    JOIN features f ON s.feature_id = f.id
    WHERE f.project_id = ?
  `
  
  const screenshots = await databaseService.all(screenshotsSql, [projectId])
  
  // Delete project (cascading will handle features, scenarios, and screenshot records)
  await databaseService.run('DELETE FROM projects WHERE id = ?', [projectId])
  
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
  
  logger.info(`Deleted project ${projectId} and ${screenshots.length} associated screenshot files by user ${req.user.userId}`)
  res.json({ message: 'Project deleted successfully' })
}))

module.exports = router
