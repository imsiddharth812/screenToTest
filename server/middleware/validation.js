const { body, param, query, validationResult } = require('express-validator')
const logger = require('../utils/logger')

// Sanitize and validate helper
const sanitizeString = (value) => {
  if (typeof value !== 'string') return value
  return value.trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
}

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    logger.warn(`Validation errors for ${req.method} ${req.path}:`, errors.array())
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    })
  }
  next()
}

// Common validation rules
const commonValidations = {
  id: param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  projectId: param('projectId').isInt({ min: 1 }).withMessage('Project ID must be a positive integer'),
  featureId: param('featureId').isInt({ min: 1 }).withMessage('Feature ID must be a positive integer'),
  scenarioId: param('scenarioId').isInt({ min: 1 }).withMessage('Scenario ID must be a positive integer'),
  screenshotId: param('screenshotId').isInt({ min: 1 }).withMessage('Screenshot ID must be a positive integer'),
  testCaseId: param('testCaseId').isInt({ min: 1 }).withMessage('Test case ID must be a positive integer'),
}

// Authentication validation
const authValidation = {
  login: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters')
      .customSanitizer(sanitizeString)
  ],
  signup: [
    body('name')
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters')
      .customSanitizer(sanitizeString),
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters')
      .customSanitizer(sanitizeString)
  ]
}

// Project validation
const projectValidation = {
  create: [
    body('name')
      .isLength({ min: 1, max: 100 })
      .withMessage('Project name is required and must be less than 100 characters')
      .customSanitizer(sanitizeString),
    body('description')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Description must be less than 500 characters')
      .customSanitizer(sanitizeString)
  ],
  update: [
    commonValidations.id,
    body('name')
      .isLength({ min: 1, max: 100 })
      .withMessage('Project name is required and must be less than 100 characters')
      .customSanitizer(sanitizeString),
    body('description')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Description must be less than 500 characters')
      .customSanitizer(sanitizeString)
  ]
}

// Feature validation
const featureValidation = {
  create: [
    commonValidations.projectId,
    body('name')
      .isLength({ min: 1, max: 100 })
      .withMessage('Feature name is required and must be less than 100 characters')
      .customSanitizer(sanitizeString),
    body('description')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Description must be less than 500 characters')
      .customSanitizer(sanitizeString)
  ],
  update: [
    commonValidations.id,
    body('name')
      .isLength({ min: 1, max: 100 })
      .withMessage('Feature name is required and must be less than 100 characters')
      .customSanitizer(sanitizeString),
    body('description')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Description must be less than 500 characters')
      .customSanitizer(sanitizeString)
  ]
}

// Scenario validation
const scenarioValidation = {
  create: [
    commonValidations.featureId,
    body('name')
      .isLength({ min: 1, max: 150 })
      .withMessage('Scenario name is required and must be less than 150 characters')
      .customSanitizer(sanitizeString),
    body('description')
      .optional()
      .isLength({ max: 1000 })
      .withMessage('Description must be less than 1000 characters')
      .customSanitizer(sanitizeString),
    body('testing_intent')
      .optional()
      .isIn(['comprehensive', 'form-validation', 'user-journey', 'integration', 'business-logic'])
      .withMessage('Invalid testing intent'),
    body('ai_model')
      .optional()
      .isIn(['claude', 'gpt-4-vision'])
      .withMessage('Invalid AI model'),
    body('user_story')
      .optional()
      .isLength({ max: 2000 })
      .withMessage('User story must be less than 2000 characters')
      .customSanitizer(sanitizeString),
    body('acceptance_criteria')
      .optional()
      .isLength({ max: 2000 })
      .withMessage('Acceptance criteria must be less than 2000 characters')
      .customSanitizer(sanitizeString),
    body('business_rules')
      .optional()
      .isLength({ max: 2000 })
      .withMessage('Business rules must be less than 2000 characters')
      .customSanitizer(sanitizeString),
    body('edge_cases')
      .optional()
      .isLength({ max: 2000 })
      .withMessage('Edge cases must be less than 2000 characters')
      .customSanitizer(sanitizeString),
    body('test_environment')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Test environment must be less than 500 characters')
      .customSanitizer(sanitizeString),
    body('coverage_level')
      .optional()
      .isIn(['essential', 'comprehensive', 'exhaustive'])
      .withMessage('Invalid coverage level'),
    body('test_types')
      .optional()
      .isArray()
      .withMessage('Test types must be an array')
  ],
  update: [
    commonValidations.id,
    body('name')
      .isLength({ min: 1, max: 150 })
      .withMessage('Scenario name is required and must be less than 150 characters')
      .customSanitizer(sanitizeString),
    body('description')
      .optional()
      .isLength({ max: 1000 })
      .withMessage('Description must be less than 1000 characters')
      .customSanitizer(sanitizeString),
    body('testing_intent')
      .optional()
      .isIn(['comprehensive', 'form-validation', 'user-journey', 'integration', 'business-logic'])
      .withMessage('Invalid testing intent'),
    body('ai_model')
      .optional()
      .isIn(['claude', 'gpt-4-vision'])
      .withMessage('Invalid AI model'),
    body('user_story')
      .optional()
      .isLength({ max: 2000 })
      .withMessage('User story must be less than 2000 characters')
      .customSanitizer(sanitizeString),
    body('acceptance_criteria')
      .optional()
      .isLength({ max: 2000 })
      .withMessage('Acceptance criteria must be less than 2000 characters')
      .customSanitizer(sanitizeString),
    body('business_rules')
      .optional()
      .isLength({ max: 2000 })
      .withMessage('Business rules must be less than 2000 characters')
      .customSanitizer(sanitizeString),
    body('edge_cases')
      .optional()
      .isLength({ max: 2000 })
      .withMessage('Edge cases must be less than 2000 characters')
      .customSanitizer(sanitizeString),
    body('test_environment')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Test environment must be less than 500 characters')
      .customSanitizer(sanitizeString),
    body('coverage_level')
      .optional()
      .isIn(['essential', 'comprehensive', 'exhaustive'])
      .withMessage('Invalid coverage level'),
    body('test_types')
      .optional()
      .isArray()
      .withMessage('Test types must be an array')
  ]
}

// Screenshot validation
const screenshotValidation = {
  update: [
    commonValidations.id,
    body('description')
      .optional()
      .isLength({ max: 255 })
      .withMessage('Description must be less than 255 characters')
      .customSanitizer(sanitizeString),
    body('custom_name')
      .optional()
      .isLength({ max: 255 })
      .withMessage('Custom name must be less than 255 characters')
      .customSanitizer(sanitizeString),
    body('order_index')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Order index must be a non-negative integer')
  ],
  reorder: [
    commonValidations.scenarioId,
    body('screenshotIds')
      .isArray()
      .withMessage('Screenshot IDs must be an array')
      .custom((value) => {
        if (!Array.isArray(value) || value.some(id => !Number.isInteger(Number(id)) || Number(id) <= 0)) {
          throw new Error('All screenshot IDs must be positive integers')
        }
        return true
      })
  ]
}

// Query parameter validation
const queryValidation = {
  analysisType: query('analysisType')
    .optional()
    .isIn(['unified', 'standard'])
    .withMessage('Invalid analysis type')
}

module.exports = {
  handleValidationErrors,
  commonValidations,
  authValidation,
  projectValidation,
  featureValidation,
  scenarioValidation,
  screenshotValidation,
  queryValidation
}
