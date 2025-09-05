require('dotenv').config()
const path = require('path')

const config = {
  // Server Configuration
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.SERVER_PORT || process.env.PORT || '3001'),
  
  // Database Configuration  
  DATABASE_URL: process.env.DATABASE_URL ? 
    (process.env.DATABASE_URL.startsWith('./') ? 
      path.resolve(process.cwd(), process.env.DATABASE_URL) : 
      process.env.DATABASE_URL) : 
    path.resolve(process.cwd(), './server/database.db'),
  
  // JWT Configuration
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  
  // API Configuration
  API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3001',
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  
  // Upload Configuration
  UPLOAD_MAX_SIZE: parseInt(process.env.UPLOAD_MAX_SIZE || '10485760'), // 10MB default
  
  // Rate Limiting Configuration
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  RATE_LIMIT_MAX_ATTEMPTS: parseInt(process.env.RATE_LIMIT_MAX_ATTEMPTS || '5'),
  
  // Claude Model Configuration
  CLAUDE_MODEL: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o'
}

// Validate required environment variables
function validateConfig() {
  const required = ['JWT_SECRET']
  const missing = required.filter(key => !config[key])
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:')
    missing.forEach(key => {
      console.error(`   - ${key}`)
    })
    console.error('\nPlease check your .env file and ensure all required variables are set.')
    process.exit(1)
  }

  // Validate JWT_SECRET strength
  if (config.JWT_SECRET.length < 32) {
    console.error('❌ JWT_SECRET must be at least 32 characters long for security.')
    console.error('Please generate a stronger secret key.')
    process.exit(1)
  }

  // Warn about development-only secrets
  if (config.NODE_ENV === 'production' && config.JWT_SECRET.includes('your-very-secure-random-secret-here')) {
    console.error('❌ Cannot use default JWT_SECRET in production!')
    console.error('Please set a secure, randomly generated JWT_SECRET.')
    process.exit(1)
  }

  console.log('✅ Configuration validated successfully')
  console.log(`🌍 Environment: ${config.NODE_ENV}`)
  console.log(`🔌 Server Port: ${config.PORT}`)
  console.log(`💾 Database: ${config.DATABASE_URL}`)
}

module.exports = { config, validateConfig }
