require('dotenv').config()
const express = require('express')
const cors = require('cors')
const multer = require('multer')
const Tesseract = require('tesseract.js')
const ExcelJS = require('exceljs')
const fs = require('fs')
const path = require('path')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const sqlite3 = require('sqlite3').verbose()
const UnifiedAIService = require('./unifiedAIService')

const app = express()
const PORT = process.env.SERVER_PORT || 3001

// Initialize Unified AI Service
const unifiedAIService = new UnifiedAIService()

// Database migration function for new scenario columns
function runMigrations() {
  console.log('Running database migrations...')
  
  // Check if new columns exist, if not add them
  db.get("PRAGMA table_info(scenarios)", (err, row) => {
    if (err) {
      console.error('Error checking table info:', err.message)
      return
    }
    
    // Get all columns in scenarios table
    db.all("PRAGMA table_info(scenarios)", (err, rows) => {
      if (err) {
        console.error('Error getting table info:', err.message)
        return
      }
      
      const existingColumns = rows.map(row => row.name)
      const newColumns = [
        { name: 'testing_intent', sql: 'ALTER TABLE scenarios ADD COLUMN testing_intent VARCHAR(50) DEFAULT "comprehensive"' },
        { name: 'user_story', sql: 'ALTER TABLE scenarios ADD COLUMN user_story TEXT' },
        { name: 'acceptance_criteria', sql: 'ALTER TABLE scenarios ADD COLUMN acceptance_criteria TEXT' },
        { name: 'business_rules', sql: 'ALTER TABLE scenarios ADD COLUMN business_rules TEXT' },
        { name: 'edge_cases', sql: 'ALTER TABLE scenarios ADD COLUMN edge_cases TEXT' },
        { name: 'test_environment', sql: 'ALTER TABLE scenarios ADD COLUMN test_environment TEXT' },
        { name: 'coverage_level', sql: 'ALTER TABLE scenarios ADD COLUMN coverage_level VARCHAR(20) DEFAULT "comprehensive"' },
        { name: 'test_types', sql: 'ALTER TABLE scenarios ADD COLUMN test_types JSON DEFAULT \'["positive","negative","edge_cases"]\'' }
      ]
      
      let migrationsRun = 0
      newColumns.forEach(column => {
        if (!existingColumns.includes(column.name)) {
          db.run(column.sql, (err) => {
            if (err) {
              console.error(`Error adding column ${column.name}:`, err.message)
            } else {
              console.log(`✓ Added column: ${column.name}`)
            }
            migrationsRun++
            if (migrationsRun === newColumns.length) {
              console.log('Database migrations completed successfully')
            }
          })
        } else {
          migrationsRun++
          if (migrationsRun === newColumns.length) {
            console.log('Database migrations completed successfully')
          }
        }
      })
    })
  })
}

// Initialize SQLite database
const db = new sqlite3.Database('./database.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message)
  } else {
    console.log('Connected to SQLite database')
    
    // Enable foreign keys for cascade deletion
    db.run('PRAGMA foreign_keys = ON', (err) => {
      if (err) {
        console.error('Error enabling foreign keys:', err.message)
      } else {
        console.log('Foreign keys enabled for cascade deletion')
      }
    })
    
    // Create tables if they don't exist
    const tables = [
      // Users table (existing)
      {
        name: 'users',
        sql: `
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `
      },
      // Projects table
      {
        name: 'projects',
        sql: `
          CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name VARCHAR(100) NOT NULL,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
          )
        `
      },
      // Features table
      {
        name: 'features',
        sql: `
          CREATE TABLE IF NOT EXISTS features (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            name VARCHAR(100) NOT NULL,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
          )
        `
      },
      // Scenarios table
      {
        name: 'scenarios',
        sql: `
          CREATE TABLE IF NOT EXISTS scenarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            feature_id INTEGER NOT NULL,
            name VARCHAR(150) NOT NULL,
            description TEXT,
            testing_intent VARCHAR(50) DEFAULT 'comprehensive',
            user_story TEXT,
            acceptance_criteria TEXT,
            business_rules TEXT,
            edge_cases TEXT,
            test_environment TEXT,
            coverage_level VARCHAR(20) DEFAULT 'comprehensive',
            test_types JSON DEFAULT '["positive","negative","edge_cases"]',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (feature_id) REFERENCES features (id) ON DELETE CASCADE
          )
        `
      },
      // Screenshots table
      {
        name: 'screenshots',
        sql: `
          CREATE TABLE IF NOT EXISTS screenshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scenario_id INTEGER NOT NULL,
            filename VARCHAR(255) NOT NULL,
            original_name VARCHAR(255) NOT NULL,
            custom_name VARCHAR(255),
            file_path TEXT NOT NULL,
            file_size INTEGER,
            order_index INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (scenario_id) REFERENCES scenarios (id) ON DELETE CASCADE
          )
        `
      },
      // Test Cases table
      {
        name: 'test_cases',
        sql: `
          CREATE TABLE IF NOT EXISTS test_cases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scenario_id INTEGER NOT NULL,
            analysis_type VARCHAR(50) NOT NULL DEFAULT 'standard',
            test_case_data TEXT NOT NULL,
            total_test_cases INTEGER DEFAULT 0,
            functional_count INTEGER DEFAULT 0,
            end_to_end_count INTEGER DEFAULT 0,
            integration_count INTEGER DEFAULT 0,
            ui_count INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (scenario_id) REFERENCES scenarios (id) ON DELETE CASCADE
          )
        `
      }
    ]

    // Create tables sequentially
    let tablesCreated = 0
    tables.forEach((table, index) => {
      db.run(table.sql, (err) => {
        if (err) {
          console.error(`Error creating ${table.name} table:`, err.message)
        } else {
          tablesCreated++
          console.log(`✓ ${table.name} table created/verified`)
          if (tablesCreated === tables.length) {
            console.log('All database tables created successfully')
            
            // Create indexes for better performance
            const indexes = [
              'CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)',
              'CREATE INDEX IF NOT EXISTS idx_features_project_id ON features(project_id)', 
              'CREATE INDEX IF NOT EXISTS idx_scenarios_feature_id ON scenarios(feature_id)',
              'CREATE INDEX IF NOT EXISTS idx_screenshots_scenario_id ON screenshots(scenario_id)',
              'CREATE INDEX IF NOT EXISTS idx_screenshots_order ON screenshots(scenario_id, order_index)',
              'CREATE INDEX IF NOT EXISTS idx_test_cases_scenario_id ON test_cases(scenario_id)',
              'CREATE INDEX IF NOT EXISTS idx_test_cases_analysis_type ON test_cases(scenario_id, analysis_type)'
            ]
            
            indexes.forEach(indexSql => {
              db.run(indexSql, (err) => {
                if (err) console.error('Error creating index:', err.message)
              })
            })
            console.log('Database indexes created successfully')
            
            // Run database migrations for existing scenarios table
            runMigrations()
          }
        }
      })
    })
  }
})

// JWT Secret (in production, this should be in environment variables)
const JWT_SECRET = process.env.JWT_SECRET || 'screen2testcases_jwt_secret_key'

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: 'Access token required' })
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' })
    }
    req.user = user
    next()
  })
}

// Middleware
app.use(cors())
app.use(express.json())

// Protected screenshot serving - users can only access their own screenshots
app.get('/api/screenshots/:screenshotId', authenticateToken, async (req, res) => {
  try {
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
    
    const screenshot = await new Promise((resolve, reject) => {
      db.get(sql, [screenshotId, req.user.userId], (err, row) => {
        if (err) reject(err)
        else resolve(row)
      })
    })
    
    if (!screenshot) {
      return res.status(404).json({ error: 'Screenshot not found or access denied' })
    }
    
    // Construct full file path
    const filePath = path.join(__dirname, screenshot.file_path)
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`Screenshot file not found: ${filePath}`)
      return res.status(404).json({ error: 'Screenshot file not found' })
    }
    
    // Set proper headers
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', 'private, max-age=3600') // Cache for 1 hour
    res.setHeader('Content-Disposition', `inline; filename="${screenshot.original_name}"`)
    
    // Serve the file securely
    res.sendFile(path.resolve(filePath))
    
  } catch (error) {
    console.error('Error serving screenshot:', error)
    res.status(500).json({ error: 'Failed to serve screenshot' })
  }
})

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = 'uploads'
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir)
    }
    cb(null, uploadDir)
  },
  filename: (_req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname)
  }
})

// Configure multer for persistent screenshot uploads
const screenshotStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = 'screenshots'
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, uniqueSuffix + '-' + file.originalname)
  }
})

const upload = multer({ 
  storage: multer.memoryStorage(), // Use memory storage for unified analysis to access buffers
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit per file
  }
})

// Mock test cases removed - we provide authentic AI-powered analysis only

// OCR processing function
async function processImageWithOCR(imagePath) {
  try {
    console.log(`Starting OCR processing for ${imagePath}...`)
    const { data: { text } } = await Tesseract.recognize(imagePath, 'eng', {
      logger: m => {
        // Only log progress, not all messages
        if (m.status && m.progress !== undefined) {
          console.log(`OCR Progress: ${m.status} - ${Math.round(m.progress * 100)}%`)
        }
      }
    })
    console.log(`OCR completed for ${imagePath}`)
    return text.trim()
  } catch (error) {
    console.error(`OCR processing failed for ${imagePath}:`, error.message)
    return `Image content from ${imagePath.split('/').pop()}: [Unable to extract text - image may be corrupted or in unsupported format]`
  }
}

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  })
})

// Authentication Routes

// Sign up route
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' })
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' })
    }

    // Check if user already exists
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, existingUser) => {
      if (err) {
        console.error('Database error:', err.message)
        return res.status(500).json({ error: 'Database error' })
      }

      if (existingUser) {
        return res.status(400).json({ error: 'User with this email already exists' })
      }

      try {
        // Hash password
        const saltRounds = 10
        const hashedPassword = await bcrypt.hash(password, saltRounds)

        // Insert new user
        db.run(
          'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
          [name, email, hashedPassword],
          function(err) {
            if (err) {
              console.error('Error creating user:', err.message)
              return res.status(500).json({ error: 'Failed to create user' })
            }

            // Generate JWT token
            const token = jwt.sign(
              { userId: this.lastID, email: email },
              JWT_SECRET,
              { expiresIn: '24h' }
            )

            // Return user data (without password) and token
            const userData = {
              id: this.lastID,
              name: name,
              email: email,
              created_at: new Date().toISOString()
            }

            res.status(201).json({
              message: 'User created successfully',
              user: userData,
              token: token
            })
          }
        )
      } catch (error) {
        console.error('Error hashing password:', error)
        res.status(500).json({ error: 'Server error' })
      }
    })
  } catch (error) {
    console.error('Signup error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Login route
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    // Find user by email
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
      if (err) {
        console.error('Database error:', err.message)
        return res.status(500).json({ error: 'Database error' })
      }

      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' })
      }

      try {
        // Compare password
        const isPasswordValid = await bcrypt.compare(password, user.password)

        if (!isPasswordValid) {
          return res.status(401).json({ error: 'Invalid email or password' })
        }

        // Generate JWT token
        const token = jwt.sign(
          { userId: user.id, email: user.email },
          JWT_SECRET,
          { expiresIn: '24h' }
        )

        // Return user data (without password) and token
        const userData = {
          id: user.id,
          name: user.name,
          email: user.email,
          created_at: user.created_at
        }

        res.json({
          message: 'Login successful',
          user: userData,
          token: token
        })
      } catch (error) {
        console.error('Error comparing password:', error)
        res.status(500).json({ error: 'Server error' })
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Get current user route (protected)
app.get('/api/auth/me', authenticateToken, (req, res) => {
  db.get('SELECT id, name, email, created_at FROM users WHERE id = ?', [req.user.userId], (err, user) => {
    if (err) {
      console.error('Database error:', err.message)
      return res.status(500).json({ error: 'Database error' })
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json({ user })
  })
})

// PROJECTS CRUD ENDPOINTS

// Get all projects for authenticated user
app.get('/api/projects', authenticateToken, (req, res) => {
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
  
  db.all(sql, [req.user.userId], (err, projects) => {
    if (err) {
      console.error('Database error:', err.message)
      return res.status(500).json({ error: 'Database error' })
    }
    
    res.json({ projects })
  })
})

// Create new project
app.post('/api/projects', authenticateToken, (req, res) => {
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
  db.run(sql, [req.user.userId, name.trim(), description?.trim() || null], function(err) {
    if (err) {
      console.error('Error creating project:', err.message)
      if (err.message.includes('FOREIGN KEY constraint failed')) {
        return res.status(401).json({ error: 'Authentication session invalid. Please log in again.' })
      }
      return res.status(500).json({ error: 'Failed to create project' })
    }
    
    // Return the created project
    db.get('SELECT * FROM projects WHERE id = ?', [this.lastID], (err, project) => {
      if (err) {
        console.error('Error fetching created project:', err.message)
        return res.status(500).json({ error: 'Project created but failed to retrieve' })
      }
      
      res.status(201).json({ project })
    })
  })
})

// Update project
app.put('/api/projects/:id', authenticateToken, (req, res) => {
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
  db.get('SELECT id FROM projects WHERE id = ? AND user_id = ?', [projectId, req.user.userId], (err, project) => {
    if (err) {
      console.error('Database error:', err.message)
      return res.status(500).json({ error: 'Database error' })
    }
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }
    
    const sql = 'UPDATE projects SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    db.run(sql, [name.trim(), description?.trim() || null, projectId], function(err) {
      if (err) {
        console.error('Error updating project:', err.message)
        return res.status(500).json({ error: 'Failed to update project' })
      }
      
      // Return the updated project
      db.get('SELECT * FROM projects WHERE id = ?', [projectId], (err, updatedProject) => {
        if (err) {
          console.error('Error fetching updated project:', err.message)
          return res.status(500).json({ error: 'Project updated but failed to retrieve' })
        }
        
        res.json({ project: updatedProject })
      })
    })
  })
})

// Delete project
app.delete('/api/projects/:id', authenticateToken, (req, res) => {
  const projectId = req.params.id
  
  // First check if project exists and belongs to user
  db.get('SELECT id FROM projects WHERE id = ? AND user_id = ?', [projectId, req.user.userId], (err, project) => {
    if (err) {
      console.error('Database error:', err.message)
      return res.status(500).json({ error: 'Database error' })
    }
    
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
    
    db.all(screenshotsSql, [projectId], (err, screenshots) => {
      if (err) {
        console.error('Error fetching screenshots for project deletion:', err.message)
        return res.status(500).json({ error: 'Database error' })
      }
      
      // Delete project (cascading will handle features, scenarios, and screenshot records)
      db.run('DELETE FROM projects WHERE id = ?', [projectId], function(err) {
        if (err) {
          console.error('Error deleting project:', err.message)
          return res.status(500).json({ error: 'Failed to delete project' })
        }
        
        // Clean up screenshot files from filesystem
        screenshots.forEach(screenshot => {
          try {
            const fullPath = path.join(__dirname, '..', screenshot.file_path)
            if (fs.existsSync(fullPath)) {
              fs.unlinkSync(fullPath)
              console.log(`Deleted screenshot file: ${screenshot.file_path}`)
            }
          } catch (fileErr) {
            console.warn(`Warning: Could not delete screenshot file ${screenshot.file_path}:`, fileErr.message)
          }
        })
        
        console.log(`Deleted project ${projectId} and ${screenshots.length} associated screenshot files`)
        res.json({ message: 'Project deleted successfully' })
      })
    })
  })
})

// FEATURES CRUD ENDPOINTS

// Get all features for a project
app.get('/api/projects/:projectId/features', authenticateToken, (req, res) => {
  const projectId = req.params.projectId
  
  // First verify project belongs to user
  db.get('SELECT id FROM projects WHERE id = ? AND user_id = ?', [projectId, req.user.userId], (err, project) => {
    if (err) {
      console.error('Database error:', err.message)
      return res.status(500).json({ error: 'Database error' })
    }
    
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
    
    db.all(sql, [projectId], (err, features) => {
      if (err) {
        console.error('Database error:', err.message)
        return res.status(500).json({ error: 'Database error' })
      }
      
      res.json({ features })
    })
  })
})

// Create new feature
app.post('/api/projects/:projectId/features', authenticateToken, (req, res) => {
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
  db.get('SELECT id FROM projects WHERE id = ? AND user_id = ?', [projectId, req.user.userId], (err, project) => {
    if (err) {
      console.error('Database error:', err.message)
      return res.status(500).json({ error: 'Database error' })
    }
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }
    
    const sql = 'INSERT INTO features (project_id, name, description) VALUES (?, ?, ?)'
    db.run(sql, [projectId, name.trim(), description?.trim() || null], function(err) {
      if (err) {
        console.error('Error creating feature:', err.message)
        return res.status(500).json({ error: 'Failed to create feature' })
      }
      
      // Return the created feature
      db.get('SELECT * FROM features WHERE id = ?', [this.lastID], (err, feature) => {
        if (err) {
          console.error('Error fetching created feature:', err.message)
          return res.status(500).json({ error: 'Feature created but failed to retrieve' })
        }
        
        res.status(201).json({ feature })
      })
    })
  })
})

// Update feature
app.put('/api/features/:id', authenticateToken, (req, res) => {
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
  
  db.get(sql, [featureId, req.user.userId], (err, feature) => {
    if (err) {
      console.error('Database error:', err.message)
      return res.status(500).json({ error: 'Database error' })
    }
    
    if (!feature) {
      return res.status(404).json({ error: 'Feature not found' })
    }
    
    const updateSql = 'UPDATE features SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    db.run(updateSql, [name.trim(), description?.trim() || null, featureId], function(err) {
      if (err) {
        console.error('Error updating feature:', err.message)
        return res.status(500).json({ error: 'Failed to update feature' })
      }
      
      // Return the updated feature
      db.get('SELECT * FROM features WHERE id = ?', [featureId], (err, updatedFeature) => {
        if (err) {
          console.error('Error fetching updated feature:', err.message)
          return res.status(500).json({ error: 'Feature updated but failed to retrieve' })
        }
        
        res.json({ feature: updatedFeature })
      })
    })
  })
})

// Delete feature
app.delete('/api/features/:id', authenticateToken, (req, res) => {
  const featureId = req.params.id
  
  // First check if feature exists and project belongs to user
  const sql = `
    SELECT f.id FROM features f 
    JOIN projects p ON f.project_id = p.id 
    WHERE f.id = ? AND p.user_id = ?
  `
  
  db.get(sql, [featureId, req.user.userId], (err, feature) => {
    if (err) {
      console.error('Database error:', err.message)
      return res.status(500).json({ error: 'Database error' })
    }
    
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
    
    db.all(screenshotsSql, [featureId], (err, screenshots) => {
      if (err) {
        console.error('Error fetching screenshots for feature deletion:', err.message)
        return res.status(500).json({ error: 'Database error' })
      }
      
      // Delete feature (cascading will handle scenarios and screenshot records)
      db.run('DELETE FROM features WHERE id = ?', [featureId], function(err) {
        if (err) {
          console.error('Error deleting feature:', err.message)
          return res.status(500).json({ error: 'Failed to delete feature' })
        }
        
        // Clean up screenshot files from filesystem
        screenshots.forEach(screenshot => {
          try {
            const fullPath = path.join(__dirname, '..', screenshot.file_path)
            if (fs.existsSync(fullPath)) {
              fs.unlinkSync(fullPath)
              console.log(`Deleted screenshot file: ${screenshot.file_path}`)
            }
          } catch (fileErr) {
            console.warn(`Warning: Could not delete screenshot file ${screenshot.file_path}:`, fileErr.message)
          }
        })
        
        console.log(`Deleted feature ${featureId} and ${screenshots.length} associated screenshot files`)
        res.json({ message: 'Feature deleted successfully' })
      })
    })
  })
})

// SCENARIOS CRUD ENDPOINTS

// Get all scenarios for a feature
app.get('/api/features/:featureId/scenarios', authenticateToken, (req, res) => {
  const featureId = req.params.featureId
  
  // First verify feature exists and project belongs to user
  const sql = `
    SELECT f.id FROM features f 
    JOIN projects p ON f.project_id = p.id 
    WHERE f.id = ? AND p.user_id = ?
  `
  
  db.get(sql, [featureId, req.user.userId], (err, feature) => {
    if (err) {
      console.error('Database error:', err.message)
      return res.status(500).json({ error: 'Database error' })
    }
    
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
    
    db.all(scenarioSql, [featureId], (err, scenarios) => {
      if (err) {
        console.error('Database error:', err.message)
        return res.status(500).json({ error: 'Database error' })
      }
      
      res.json({ scenarios })
    })
  })
})

// Create new scenario
app.post('/api/features/:featureId/scenarios', authenticateToken, (req, res) => {
  const featureId = req.params.featureId
  const { 
    name, 
    description, 
    testing_intent = 'comprehensive',
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
  
  db.get(sql, [featureId, req.user.userId], (err, feature) => {
    if (err) {
      console.error('Database error:', err.message)
      return res.status(500).json({ error: 'Database error' })
    }
    
    if (!feature) {
      return res.status(404).json({ error: 'Feature not found' })
    }
    
    const insertSql = `INSERT INTO scenarios 
      (feature_id, name, description, testing_intent, user_story, acceptance_criteria, 
       business_rules, edge_cases, test_environment, coverage_level, test_types) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    
    db.run(insertSql, [
      featureId, 
      name.trim(), 
      description?.trim() || null,
      testing_intent,
      user_story?.trim() || null,
      acceptance_criteria?.trim() || null,
      business_rules?.trim() || null,
      edge_cases?.trim() || null,
      test_environment?.trim() || null,
      coverage_level,
      JSON.stringify(test_types)
    ], function(err) {
      if (err) {
        console.error('Error creating scenario:', err.message)
        return res.status(500).json({ error: 'Failed to create scenario' })
      }
      
      // Return the created scenario
      db.get('SELECT * FROM scenarios WHERE id = ?', [this.lastID], (err, scenario) => {
        if (err) {
          console.error('Error fetching created scenario:', err.message)
          return res.status(500).json({ error: 'Scenario created but failed to retrieve' })
        }
        
        res.status(201).json({ scenario })
      })
    })
  })
})

// Update scenario
app.put('/api/scenarios/:id', authenticateToken, (req, res) => {
  const scenarioId = req.params.id
  const { 
    name, 
    description, 
    testing_intent,
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
  
  db.get(sql, [scenarioId, req.user.userId], (err, scenario) => {
    if (err) {
      console.error('Database error:', err.message)
      return res.status(500).json({ error: 'Database error' })
    }
    
    if (!scenario) {
      return res.status(404).json({ error: 'Scenario not found' })
    }
    
    const updateSql = `UPDATE scenarios SET 
      name = ?, description = ?, testing_intent = ?, user_story = ?, acceptance_criteria = ?,
      business_rules = ?, edge_cases = ?, test_environment = ?, coverage_level = ?, 
      test_types = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?`
    
    db.run(updateSql, [
      name.trim(), 
      description?.trim() || null,
      testing_intent,
      user_story?.trim() || null,
      acceptance_criteria?.trim() || null,
      business_rules?.trim() || null,
      edge_cases?.trim() || null,
      test_environment?.trim() || null,
      coverage_level,
      test_types ? JSON.stringify(test_types) : null,
      scenarioId
    ], function(err) {
      if (err) {
        console.error('Error updating scenario:', err.message)
        return res.status(500).json({ error: 'Failed to update scenario' })
      }
      
      // Return the updated scenario
      db.get('SELECT * FROM scenarios WHERE id = ?', [scenarioId], (err, updatedScenario) => {
        if (err) {
          console.error('Error fetching updated scenario:', err.message)
          return res.status(500).json({ error: 'Scenario updated but failed to retrieve' })
        }
        
        res.json({ scenario: updatedScenario })
      })
    })
  })
})

// Delete scenario
app.delete('/api/scenarios/:id', authenticateToken, (req, res) => {
  const scenarioId = req.params.id
  
  // First check if scenario exists and project belongs to user
  const sql = `
    SELECT s.id FROM scenarios s 
    JOIN features f ON s.feature_id = f.id 
    JOIN projects p ON f.project_id = p.id 
    WHERE s.id = ? AND p.user_id = ?
  `
  
  db.get(sql, [scenarioId, req.user.userId], (err, scenario) => {
    if (err) {
      console.error('Database error:', err.message)
      return res.status(500).json({ error: 'Database error' })
    }
    
    if (!scenario) {
      return res.status(404).json({ error: 'Scenario not found' })
    }
    
    // First get all screenshot files for this scenario to clean up from filesystem
    db.all('SELECT file_path FROM screenshots WHERE scenario_id = ?', [scenarioId], (err, screenshots) => {
      if (err) {
        console.error('Error fetching screenshots for deletion:', err.message)
        return res.status(500).json({ error: 'Database error' })
      }
      
      // Delete scenario (foreign key cascade will delete screenshot records)
      db.run('DELETE FROM scenarios WHERE id = ?', [scenarioId], function(err) {
        if (err) {
          console.error('Error deleting scenario:', err.message)
          return res.status(500).json({ error: 'Failed to delete scenario' })
        }
        
        // Clean up screenshot files from filesystem
        screenshots.forEach(screenshot => {
          try {
            const fullPath = path.join(__dirname, '..', screenshot.file_path)
            if (fs.existsSync(fullPath)) {
              fs.unlinkSync(fullPath)
              console.log(`Deleted screenshot file: ${screenshot.file_path}`)
            }
          } catch (fileErr) {
            console.warn(`Warning: Could not delete screenshot file ${screenshot.file_path}:`, fileErr.message)
          }
        })
        
        console.log(`Deleted scenario ${scenarioId} and ${screenshots.length} associated screenshot files`)
        res.json({ message: 'Scenario deleted successfully' })
      })
    })
  })
})

// Screenshots CRUD API endpoints

const screenshotUpload = multer({ storage: screenshotStorage })

// Get screenshots for a scenario
app.get('/api/screenshots/:scenarioId', authenticateToken, (req, res) => {
  const scenarioId = req.params.scenarioId
  
  // First check if scenario exists and project belongs to user
  const sql = `
    SELECT s.id FROM scenarios s 
    JOIN features f ON s.feature_id = f.id 
    JOIN projects p ON f.project_id = p.id 
    WHERE s.id = ? AND p.user_id = ?
  `
  
  db.get(sql, [scenarioId, req.user.userId], (err, scenario) => {
    if (err) {
      console.error('Database error:', err.message)
      return res.status(500).json({ error: 'Database error' })
    }
    
    if (!scenario) {
      return res.status(404).json({ error: 'Scenario not found' })
    }
    
    // Get screenshots for the scenario
    const screenshotsSql = 'SELECT * FROM screenshots WHERE scenario_id = ? ORDER BY created_at ASC'
    db.all(screenshotsSql, [scenarioId], (err, screenshots) => {
      if (err) {
        console.error('Error fetching screenshots:', err.message)
        return res.status(500).json({ error: 'Failed to fetch screenshots' })
      }
      
      res.json({ screenshots })
    })
  })
})

// Upload screenshot for a scenario
app.post('/api/screenshots/:scenarioId', authenticateToken, screenshotUpload.single('screenshot'), (req, res) => {
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
  
  db.get(sql, [scenarioId, req.user.userId], (err, scenario) => {
    if (err) {
      console.error('Database error:', err.message)
      return res.status(500).json({ error: 'Database error' })
    }
    
    if (!scenario) {
      return res.status(404).json({ error: 'Scenario not found' })
    }
    
    // Insert screenshot record
    const insertSql = `
      INSERT INTO screenshots (scenario_id, filename, original_name, custom_name, file_path, file_size, created_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `
    
    const values = [
      scenarioId,
      req.file.filename,
      req.file.originalname,
      description?.trim() || req.file.originalname,
      req.file.path,
      req.file.size
    ]
    
    db.run(insertSql, values, function(err) {
      if (err) {
        console.error('Error saving screenshot:', err.message)
        return res.status(500).json({ error: 'Failed to save screenshot' })
      }
      
      // Return the created screenshot
      db.get('SELECT * FROM screenshots WHERE id = ?', [this.lastID], (err, screenshot) => {
        if (err) {
          console.error('Error fetching created screenshot:', err.message)
          return res.status(500).json({ error: 'Screenshot saved but failed to retrieve' })
        }
        
        res.json({ screenshot })
      })
    })
  })
})

// Update screenshot description
app.put('/api/screenshots/:id', authenticateToken, (req, res) => {
  const screenshotId = req.params.id
  const { description } = req.body
  
  // First check if screenshot exists and project belongs to user
  const sql = `
    SELECT sc.id FROM screenshots sc
    JOIN scenarios s ON sc.scenario_id = s.id 
    JOIN features f ON s.feature_id = f.id 
    JOIN projects p ON f.project_id = p.id 
    WHERE sc.id = ? AND p.user_id = ?
  `
  
  db.get(sql, [screenshotId, req.user.userId], (err, screenshot) => {
    if (err) {
      console.error('Database error:', err.message)
      return res.status(500).json({ error: 'Database error' })
    }
    
    if (!screenshot) {
      return res.status(404).json({ error: 'Screenshot not found' })
    }
    
    const updateSql = 'UPDATE screenshots SET custom_name = ? WHERE id = ?'
    db.run(updateSql, [description?.trim() || null, screenshotId], function(err) {
      if (err) {
        console.error('Error updating screenshot:', err.message)
        return res.status(500).json({ error: 'Failed to update screenshot' })
      }
      
      // Return the updated screenshot
      db.get('SELECT * FROM screenshots WHERE id = ?', [screenshotId], (err, updatedScreenshot) => {
        if (err) {
          console.error('Error fetching updated screenshot:', err.message)
          return res.status(500).json({ error: 'Screenshot updated but failed to retrieve' })
        }
        
        res.json({ screenshot: updatedScreenshot })
      })
    })
  })
})

// Delete screenshot
app.delete('/api/screenshots/:id', authenticateToken, (req, res) => {
  const screenshotId = req.params.id
  
  // First check if screenshot exists and project belongs to user
  const sql = `
    SELECT sc.id, sc.file_path FROM screenshots sc
    JOIN scenarios s ON sc.scenario_id = s.id 
    JOIN features f ON s.feature_id = f.id 
    JOIN projects p ON f.project_id = p.id 
    WHERE sc.id = ? AND p.user_id = ?
  `
  
  db.get(sql, [screenshotId, req.user.userId], (err, screenshot) => {
    if (err) {
      console.error('Database error:', err.message)
      return res.status(500).json({ error: 'Database error' })
    }
    
    if (!screenshot) {
      return res.status(404).json({ error: 'Screenshot not found' })
    }
    
    // Delete screenshot from database
    db.run('DELETE FROM screenshots WHERE id = ?', [screenshotId], function(err) {
      if (err) {
        console.error('Error deleting screenshot:', err.message)
        return res.status(500).json({ error: 'Failed to delete screenshot' })
      }
      
      // Try to delete the physical file
      try {
        if (fs.existsSync(screenshot.file_path)) {
          fs.unlinkSync(screenshot.file_path)
        }
      } catch (fileErr) {
        console.warn('Warning: Could not delete screenshot file:', fileErr.message)
      }
      
      res.json({ message: 'Screenshot deleted successfully' })
    })
  })
})

// Store OCR results temporarily for regeneration
const ocrCache = new Map()

// Smart UI Element Filtering Function
function smartFilterUIElements(ocrText, pageIndex, pageName) {
  const lines = ocrText.split('\n').filter(line => line.trim().length > 0)
  const filteredElements = []
  const seenElements = new Set()
  
  // Patterns for different types of UI elements
  const patterns = {
    // Interactive elements (high priority)
    buttons: /\b(button|btn|click|submit|save|create|add|edit|delete|cancel|ok|apply|search|filter|export|import|download|upload|login|logout|signin|signup|register)\b/i,
    links: /\b(link|navigate|goto|view|details|more|see|show|open)\b/i,
    formControls: /\b(input|field|textbox|dropdown|select|checkbox|radio|toggle|switch|slider)\b/i,
    navigation: /\b(menu|nav|home|dashboard|back|next|previous|breadcrumb|tab|page)\b/i,
    
    // Data patterns (low priority - group these)
    emails: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
    phones: /\b[\+]?[\d\s\(\)\-\.]{10,}\b/,
    dates: /\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b|\b\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{2,4}\b/i,
    numbers: /^\d+$/,
    ids: /^\d{4,}$/,
    
    // Common data table headers
    tableHeaders: /\b(name|email|phone|date|created|id|number|status|type|category|description|title|amount|price|quantity|total)\b/i,
    
    // Noise patterns (exclude these)
    timestamps: /\b\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM)?\b/i,
    commonWords: /\b(the|and|or|but|in|on|at|to|for|of|with|by|from|up|about|into|through|during|before|after|above|below|between|among|this|that|these|those|all|any|some|few|more|most|other|another|such|what|which|who|when|where|why|how)\b/i
  }

  lines.forEach((line, lineIndex) => {
    const text = line.trim()
    if (text.length < 2 || seenElements.has(text.toLowerCase())) {
      return // Skip empty, short, or duplicate text
    }

    // Skip obvious noise
    if (patterns.commonWords.test(text) && text.length < 10) {
      return
    }

    // Skip timestamps
    if (patterns.timestamps.test(text)) {
      return
    }

    // Categorize the element
    let category = 'data'
    let priority = 3 // Low priority by default
    let autoLabel = ''
    let elementType = 'unknown'

    // High priority interactive elements
    if (patterns.buttons.test(text)) {
      category = 'interactive'
      priority = 1
      elementType = 'button'
      autoLabel = 'Button: ' + text
    } else if (patterns.links.test(text) || text.toLowerCase().includes('click')) {
      category = 'interactive'
      priority = 1
      elementType = 'link'
      autoLabel = 'Link: ' + text
    } else if (patterns.navigation.test(text)) {
      category = 'navigation'
      priority = 1
      elementType = 'navigation'
      autoLabel = 'Navigation: ' + text
    } else if (patterns.formControls.test(text) || text.includes(':') || text.endsWith('*')) {
      category = 'form'
      priority = 2
      elementType = 'form_field'
      autoLabel = 'Form Field: ' + text.replace('*', ' (Required)')
    } else if (patterns.tableHeaders.test(text) && text.length < 20) {
      category = 'structure'
      priority = 2
      elementType = 'table_header'
      autoLabel = 'Table Header: ' + text
    }

    // Group repetitive data patterns
    if (patterns.emails.test(text)) {
      if (!seenElements.has('email_data_group')) {
        filteredElements.push({
          id: `${pageIndex}-email-group`,
          text: 'Email addresses in table',
          label: autoLabel || 'Table Data: Email Addresses',
          type: 'table_data',
          category: 'data',
          priority: 4,
          grouped: true,
          examples: [text]
        })
        seenElements.add('email_data_group')
      }
      return
    }

    if (patterns.phones.test(text)) {
      if (!seenElements.has('phone_data_group')) {
        filteredElements.push({
          id: `${pageIndex}-phone-group`,
          text: 'Phone numbers in table',
          label: autoLabel || 'Table Data: Phone Numbers',
          type: 'table_data',
          category: 'data',
          priority: 4,
          grouped: true,
          examples: [text]
        })
        seenElements.add('phone_data_group')
      }
      return
    }

    if (patterns.dates.test(text)) {
      if (!seenElements.has('date_data_group')) {
        filteredElements.push({
          id: `${pageIndex}-date-group`,
          text: 'Dates in table',
          label: autoLabel || 'Table Data: Dates',
          type: 'table_data',
          category: 'data',
          priority: 4,
          grouped: true,
          examples: [text]
        })
        seenElements.add('date_data_group')
      }
      return
    }

    if (patterns.ids.test(text)) {
      if (!seenElements.has('id_data_group')) {
        filteredElements.push({
          id: `${pageIndex}-id-group`,
          text: 'ID numbers in table',
          label: autoLabel || 'Table Data: ID Numbers',
          type: 'table_data',
          category: 'data',
          priority: 4,
          grouped: true,
          examples: [text]
        })
        seenElements.add('id_data_group')
      }
      return
    }

    // Only include individual elements if they're likely to be UI controls or important labels
    if (category !== 'data' || (text.length <= 50 && !patterns.numbers.test(text))) {
      filteredElements.push({
        id: `${pageIndex}-${lineIndex}`,
        text: text,
        label: autoLabel,
        type: elementType,
        category: category,
        priority: priority
      })
      seenElements.add(text.toLowerCase())
    }
  })

  // Sort by priority (1 = highest, 4 = lowest)
  return filteredElements.sort((a, b) => a.priority - b.priority)
}

// Test Case Persistence Helper Functions
const saveTestCasesToDB = (scenarioId, analysisType, testCases) => {
  return new Promise((resolve, reject) => {
    const testCaseData = JSON.stringify(testCases)
    const totalCount = testCases.allTestCases ? testCases.allTestCases.length : 0
    const functionalCount = testCases.functional ? testCases.functional.length : 0
    const endToEndCount = testCases.endToEnd ? testCases.endToEnd.length : 0  
    const integrationCount = testCases.integration ? testCases.integration.length : 0
    const uiCount = testCases.ui ? testCases.ui.length : 0

    // First, delete existing test cases for this scenario and analysis type
    db.run(
      'DELETE FROM test_cases WHERE scenario_id = ? AND analysis_type = ?',
      [scenarioId, analysisType],
      function(deleteErr) {
        if (deleteErr) {
          console.error('Error deleting existing test cases:', deleteErr.message)
          return reject(deleteErr)
        }

        // Insert new test cases
        db.run(
          `INSERT INTO test_cases 
           (scenario_id, analysis_type, test_case_data, total_test_cases, functional_count, end_to_end_count, integration_count, ui_count, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [scenarioId, analysisType, testCaseData, totalCount, functionalCount, endToEndCount, integrationCount, uiCount],
          function(insertErr) {
            if (insertErr) {
              console.error('Error saving test cases to DB:', insertErr.message)
              return reject(insertErr)
            }
            
            console.log(`✓ Test cases saved to DB for scenario ${scenarioId} (${analysisType})`)
            resolve(this.lastID)
          }
        )
      }
    )
  })
}

const getTestCasesFromDB = (scenarioId, analysisType = null) => {
  return new Promise((resolve, reject) => {
    let query = 'SELECT * FROM test_cases WHERE scenario_id = ?'
    let params = [scenarioId]
    
    if (analysisType) {
      query += ' AND analysis_type = ?'
      params.push(analysisType)
    }
    
    query += ' ORDER BY updated_at DESC'
    
    db.all(query, params, (err, rows) => {
      if (err) {
        console.error('Error retrieving test cases from DB:', err.message)
        return reject(err)
      }
      
      const testCases = rows.map(row => ({
        id: row.id,
        scenarioId: row.scenario_id,
        analysisType: row.analysis_type,
        testCases: JSON.parse(row.test_case_data),
        totalCount: row.total_test_cases,
        functionalCount: row.functional_count,
        endToEndCount: row.end_to_end_count,
        integrationCount: row.integration_count,
        uiCount: row.ui_count,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))
      
      resolve(testCases)
    })
  })
}

// Test Case Persistence Helper Functions
const storeTestCases = (db, scenarioId, testCases, analysisType) => {
  return new Promise((resolve, reject) => {
    const testCaseData = JSON.stringify(testCases)
    const totalCount = testCases.allTestCases ? testCases.allTestCases.length : 0
    const functionalCount = testCases.functional ? testCases.functional.length : 0
    const endToEndCount = testCases.endToEnd ? testCases.endToEnd.length : 0  
    const integrationCount = testCases.integration ? testCases.integration.length : 0
    const uiCount = testCases.ui ? testCases.ui.length : 0

    // First, delete existing test cases for this scenario and analysis type
    db.run(
      'DELETE FROM test_cases WHERE scenario_id = ? AND analysis_type = ?',
      [scenarioId, analysisType],
      function(deleteErr) {
        if (deleteErr) {
          console.error('Error deleting existing test cases:', deleteErr.message)
          return reject(deleteErr)
        }

        // Insert new test cases
        db.run(
          `INSERT INTO test_cases 
           (scenario_id, analysis_type, test_case_data, total_test_cases, functional_count, end_to_end_count, integration_count, ui_count, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [scenarioId, analysisType, testCaseData, totalCount, functionalCount, endToEndCount, integrationCount, uiCount],
          function(insertErr) {
            if (insertErr) {
              console.error('Error saving test cases to DB:', insertErr.message)
              return reject(insertErr)
            }
            
            console.log(`✓ Test cases saved to DB for scenario ${scenarioId} (${analysisType})`)
            resolve(this.lastID)
          }
        )
      }
    )
  })
}

// Unified Test Case Generation Endpoint
app.post('/api/generate-testcases', upload.any(), async (req, res) => {
  try {
    console.log('Processing Unified AI test case generation request...')
    
    const files = req.files
    if (!files || files.length < 1) {
      return res.status(400).json({ error: 'At least 1 image required' })
    }

    if (files.length > 25) {
      return res.status(400).json({ error: 'Maximum 25 images allowed for comprehensive testing' })
    }

    console.log(`Processing ${files.length} images with Unified AI...`)

    // Get page names and scenario ID from request
    const pageNames = req.body.pageNames ? JSON.parse(req.body.pageNames) : []
    const scenarioId = req.body.scenarioId ? parseInt(req.body.scenarioId) : null
    console.log('Page names received:', pageNames)
    console.log('Scenario ID received:', scenarioId)

    // Sort files by originalname to maintain consistent order
    files.sort((a, b) => a.originalname.localeCompare(b.originalname))

    // Process each image with OCR
    console.log('Starting OCR processing for all images...')
    const ocrResults = []
    const screenshotPaths = []
    
    for (let file of files) {
      try {
        console.log(`Processing OCR for: ${file.originalname}`)
        
        // Validate file buffer
        if (!file.buffer || !Buffer.isBuffer(file.buffer)) {
          console.error(`Invalid buffer for ${file.originalname}`)
          ocrResults.push('')
          screenshotPaths.push(null)
          continue
        }
        
        console.log(`File buffer size: ${file.buffer.length} bytes`)
        
        // Process OCR with better error handling
        const { data: { text } } = await Tesseract.recognize(file.buffer, 'eng', {
          logger: m => console.log(`OCR Progress for ${file.originalname}:`, m)
        })
        ocrResults.push(text.trim())
        
        // Save screenshot to temp location for vision analysis
        const tempPath = path.join(__dirname, '../temp', `screenshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`)
        fs.writeFileSync(tempPath, file.buffer)
        screenshotPaths.push(tempPath)
        
        console.log(`OCR completed for: ${file.originalname}`)
      } catch (ocrError) {
        console.error(`OCR failed for ${file.originalname}:`, ocrError)
        ocrResults.push('') // Add empty text for failed OCR
        
        // Still try to save screenshot for vision analysis if buffer exists
        if (file.buffer && Buffer.isBuffer(file.buffer)) {
          try {
            const tempPath = path.join(__dirname, '../temp', `screenshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`)
            fs.writeFileSync(tempPath, file.buffer)
            screenshotPaths.push(tempPath)
          } catch (saveError) {
            console.error(`Failed to save screenshot for ${file.originalname}:`, saveError)
            // Create a dummy path so array indices match
            screenshotPaths.push(null)
          }
        } else {
          // Create a dummy path so array indices match
          screenshotPaths.push(null)
        }
      }
    }

    console.log('All OCR processing completed. Generating comprehensive test cases with Unified AI...')

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
    
    console.log(`Processing ${validScreenshotPaths.length} valid screenshots out of ${screenshotPaths.length} total`)
    
    // Retrieve scenario context if scenarioId is provided
    let scenarioContext = {}
    if (scenarioId) {
      try {
        const scenario = await new Promise((resolve, reject) => {
          db.get('SELECT * FROM scenarios WHERE id = ?', [scenarioId], (err, row) => {
            if (err) reject(err)
            else resolve(row)
          })
        })
        
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
          console.log('Retrieved scenario context:', scenarioContext.testing_intent, scenarioContext.coverage_level)
        }
      } catch (error) {
        console.error('Error retrieving scenario context:', error)
        // Continue with default context if retrieval fails
      }
    }
    
    try {
      // Generate test cases using Unified AI service (combines OCR + Vision)
      const testCases = await unifiedAIService.generateTestCases(validScreenshotPaths, validOcrResults, validPageNames, false, scenarioContext)
      
      if (testCases && testCases.allTestCases && testCases.allTestCases.length > 0) {
        // Store in database with analysis_type as 'unified'
        if (scenarioId) {
          await storeTestCases(db, scenarioId, testCases, 'unified')
          console.log(`Unified AI test cases stored in database with scenario ID: ${scenarioId}`)
          console.log(`Generated ${testCases.allTestCases.length} comprehensive test cases`)
        } else {
          console.log('No scenario ID provided - test cases not stored in database')
        }
        
        // Clean up temporary screenshot files
        validScreenshotPaths.forEach(tempPath => {
          try {
            if (tempPath && fs.existsSync(tempPath)) {
              fs.unlinkSync(tempPath)
            }
          } catch (cleanupError) {
            console.warn('Failed to cleanup temp file:', tempPath)
          }
        })
        
        console.log(`Unified AI generated ${testCases.allTestCases.length} comprehensive test cases successfully!`)
        res.json(testCases)
      } else {
        throw new Error('No test cases generated by Unified AI')
      }
    } catch (aiError) {
      console.error('Unified AI Error details:', aiError)
      
      // Clean up temporary screenshot files on error
      validScreenshotPaths.forEach(tempPath => {
        try {
          if (tempPath && fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath)
          }
        } catch (cleanupError) {
          console.warn('Failed to cleanup temp file on error:', tempPath)
        }
      })
      
      // Check if it's an API error or parsing error
      if (aiError.message && aiError.message.includes('AI response could not be parsed')) {
        console.log('Parsing error - attempting to return structured error response')
        return res.status(500).json({ 
          error: 'Comprehensive test case generation failed due to AI response format issues. Please try again.',
          details: 'Unified AI service returned response in unexpected format'
        })
      }
      
      // Check if it's an API quota or rate limit error
      if (aiError.status === 529 || aiError.message.includes('overloaded')) {
        console.log('Unified AI service overloaded - returning retry message')
        return res.status(503).json({ 
          error: 'Comprehensive AI service is temporarily overloaded. Please wait a moment and try again.',
          _retry: true,
          _retryAfter: 30
        })
      }

      console.log('Unified AI service failed, returning clear error message')
      res.status(500).json({ 
        error: 'Comprehensive AI service is temporarily unavailable. Please try again in a few minutes.',
        _retry: true,
        _suggestion: 'Our Unified AI analyzes both your screenshots and text content to generate highly comprehensive test cases with maximum coverage.'
      })
    }
  } catch (error) {
    console.error('General Error in Unified /api/generate-testcases:', error)
    res.status(500).json({ 
      error: 'An unexpected error occurred during comprehensive test case generation. Please try again.',
      details: error.message
    })
  }
})
// Analysis options endpoint - returns unified analysis type
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

// Debug endpoint to check environment variables
app.get('/api/debug/env', (req, res) => {
  res.json({
    hasApiKey: !!process.env.ANTHROPIC_API_KEY,
    keyLength: process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.length : 0,
    keyPrefix: process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.substring(0, 10) + '...' : 'NOT SET',
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT
  })
})

// Download endpoints

app.post('/api/download/xlsx', async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Error generating XLSX:', error)
    res.status(500).json({ error: 'Failed to generate XLSX' })
  }
})

// Get saved test cases for a scenario
app.get('/api/scenarios/:scenarioId/test-cases', authenticateToken, async (req, res) => {
  try {
    const { scenarioId } = req.params
    const { analysisType } = req.query // Optional filter by analysis type
    
    // Verify scenario belongs to user
    const scenario = await new Promise((resolve, reject) => {
      db.get(`
        SELECT s.*, f.project_id 
        FROM scenarios s
        JOIN features f ON s.feature_id = f.id
        JOIN projects p ON f.project_id = p.id
        WHERE s.id = ? AND p.user_id = ?
      `, [scenarioId, req.user.userId], (err, row) => {
        if (err) reject(err)
        else resolve(row)
      })
    })
    
    if (!scenario) {
      return res.status(404).json({ error: 'Scenario not found or access denied' })
    }
    
    const testCases = await getTestCasesFromDB(parseInt(scenarioId), analysisType)
    res.json({ testCases, scenario })
  } catch (error) {
    console.error('Error retrieving test cases:', error)
    res.status(500).json({ error: 'Failed to retrieve test cases' })
  }
})

// Get a specific test case by ID
app.get('/api/test-cases/:testCaseId', authenticateToken, async (req, res) => {
  try {
    const { testCaseId } = req.params
    
    const testCase = await new Promise((resolve, reject) => {
      db.get(`
        SELECT tc.*, s.name as scenario_name, f.name as feature_name, p.name as project_name
        FROM test_cases tc
        JOIN scenarios s ON tc.scenario_id = s.id
        JOIN features f ON s.feature_id = f.id
        JOIN projects p ON f.project_id = p.id
        WHERE tc.id = ? AND p.user_id = ?
      `, [testCaseId, req.user.userId], (err, row) => {
        if (err) reject(err)
        else resolve(row)
      })
    })
    
    if (!testCase) {
      return res.status(404).json({ error: 'Test case not found or access denied' })
    }
    
    // Parse the test case data
    const formattedTestCase = {
      id: testCase.id,
      scenarioId: testCase.scenario_id,
      analysisType: testCase.analysis_type,
      testCases: JSON.parse(testCase.test_case_data),
      totalCount: testCase.total_test_cases,
      functionalCount: testCase.functional_count,
      endToEndCount: testCase.end_to_end_count,
      integrationCount: testCase.integration_count,
      uiCount: testCase.ui_count,
      createdAt: testCase.created_at,
      updatedAt: testCase.updated_at,
      scenario: {
        name: testCase.scenario_name,
        feature: testCase.feature_name,
        project: testCase.project_name
      }
    }
    
    res.json(formattedTestCase)
  } catch (error) {
    console.error('Error retrieving test case:', error)
    res.status(500).json({ error: 'Failed to retrieve test case' })
  }
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})