const express = require('express')
const bcrypt = require('bcryptjs')
const { authenticateToken, generateToken } = require('../middleware/auth')
const { authValidation, handleValidationErrors } = require('../middleware/validation')
const { authLimiter } = require('../middleware/security')
const { catchAsync, AppError } = require('../middleware/errorHandler')
const databaseService = require('../services/database')
const logger = require('../utils/logger')

const router = express.Router()

// Apply authentication rate limiting to all auth routes
router.use(authLimiter)

// Sign up route
router.post('/signup', authValidation.signup, handleValidationErrors, catchAsync(async (req, res) => {
  const { name, email, password } = req.body

  // Check if user already exists
  const existingUser = await databaseService.get('SELECT * FROM users WHERE email = ?', [email])
  
  if (existingUser) {
    throw new AppError('User with this email already exists', 400)
  }

  // Hash password
  const saltRounds = 12 // Increased from 10 for better security
  const hashedPassword = await bcrypt.hash(password, saltRounds)

  // Insert new user
  const result = await databaseService.run(
    'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
    [name, email, hashedPassword]
  )

  // Generate JWT token
  const token = generateToken({
    userId: result.lastID,
    email: email
  })

  // Return user data (without password) and token
  const userData = {
    id: result.lastID,
    name: name,
    email: email,
    created_at: new Date().toISOString()
  }

  logger.info(`New user registered: ${email} (ID: ${result.lastID})`)

  res.status(201).json({
    message: 'User created successfully',
    user: userData,
    token: token
  })
}))

// Login route
router.post('/login', authValidation.login, handleValidationErrors, catchAsync(async (req, res) => {
  const { email, password } = req.body

  // Find user by email
  const user = await databaseService.get('SELECT * FROM users WHERE email = ?', [email])
  
  if (!user) {
    throw new AppError('Invalid email or password', 401)
  }

  // Compare password
  const isPasswordValid = await bcrypt.compare(password, user.password)

  if (!isPasswordValid) {
    logger.warn(`Failed login attempt for email: ${email} from IP: ${req.ip}`)
    throw new AppError('Invalid email or password', 401)
  }

  // Generate JWT token
  const token = generateToken({
    userId: user.id,
    email: user.email
  })

  // Return user data (without password) and token
  const userData = {
    id: user.id,
    name: user.name,
    email: user.email,
    created_at: user.created_at
  }

  logger.info(`User logged in: ${email} (ID: ${user.id})`)

  res.json({
    message: 'Login successful',
    user: userData,
    token: token
  })
}))

// Get current user route (protected)
router.get('/me', authenticateToken, catchAsync(async (req, res) => {
  const user = await databaseService.get(
    'SELECT id, name, email, created_at FROM users WHERE id = ?',
    [req.user.userId]
  )

  if (!user) {
    throw new AppError('User not found', 404)
  }

  res.json({ user })
}))

module.exports = router
