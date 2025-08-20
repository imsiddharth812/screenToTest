require('dotenv').config()
const express = require('express')
const cors = require('cors')
const multer = require('multer')
const Tesseract = require('tesseract.js')
const { Document, Packer, Paragraph, TextRun } = require('docx')
const ExcelJS = require('exceljs')
const fs = require('fs')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const sqlite3 = require('sqlite3').verbose()
const AIService = require('./aiService')

const app = express()
const PORT = process.env.SERVER_PORT || 3001

// Initialize AI Service
const aiService = new AIService()

// Initialize SQLite database
const db = new sqlite3.Database('./database.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message)
  } else {
    console.log('Connected to SQLite database')
    
    // Create users table if it doesn't exist
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('Error creating users table:', err.message)
      } else {
        console.log('Database tables created successfully')
      }
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

const upload = multer({ storage })

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

// Routes
app.post('/api/generate-testcases', upload.any(), async (req, res) => {
  try {
    const files = req.files
    if (!files || files.length < 1) {
      return res.status(400).json({ error: 'At least 1 image required' })
    }

    if (files.length > 25) {
      return res.status(400).json({ error: 'Maximum 25 images allowed for comprehensive testing' })
    }

    console.log(`Processing ${files.length} images...`)

    // Get page names from request
    const pageNames = req.body.pageNames ? JSON.parse(req.body.pageNames) : []
    console.log('Page names received:', pageNames)

    // Sort files by originalname to maintain consistent order
    files.sort((a, b) => a.originalname.localeCompare(b.originalname))

    // Process each image with OCR
    const ocrResults = []
    for (const file of files) {
      try {
        console.log(`Processing OCR for ${file.filename}...`)
        const text = await processImageWithOCR(file.path)
        if (text && text.trim().length > 0) {
          ocrResults.push(text)
        }
        
        // Clean up uploaded file
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path)
        }
      } catch (error) {
        console.error(`Error processing file ${file.filename}:`, error.message)
        // Clean up uploaded file even if processing failed
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path)
        }
        // Add a placeholder for failed OCR
        ocrResults.push(`File ${file.filename}: [Processing failed - using filename for context]`)
      }
    }

    console.log('OCR Results:', ocrResults)


    // Generate test cases using Claude AI
    const forceRegenerate = req.body.regenerate === 'true'
    console.log(`Generating test cases with Claude AI... ${forceRegenerate ? '(forced regeneration)' : ''}`)
    const testCases = await aiService.generateTestCases(ocrResults, files.length, forceRegenerate, pageNames)

    // Store OCR results for potential regeneration
    const sessionId = Date.now().toString()
    ocrCache.set(sessionId, { ocrResults, imageCount: files.length, pageNames })
    testCases._sessionId = sessionId

    console.log('AI generated test cases successfully!')
    res.json(testCases)
  } catch (error) {
    console.error('Error generating test cases:', error)

    // Check if it's an API overload error (529)
    if (error.status === 529) {
      return res.status(503).json({ 
        error: 'AI service is temporarily overloaded. Please try again in a few moments.',
        retryAfter: 30,
        _temporary: true
      })
    }

    // Return clear error message instead of fake results
    console.log('AI service failed, returning clear error message')
    res.status(500).json({ 
      error: 'AI service is temporarily unavailable. Please try again in a few minutes.',
      _retry: true,
      _suggestion: 'Our AI analyzes your actual screenshots to generate relevant test cases. Generic templates would not provide the quality you expect.'
    })
  }
})

// Generate test cases with corrected labels
app.post('/api/generate-with-corrections', async (req, res) => {
  try {
    const { sessionId, correctedElements } = req.body
    
    if (!sessionId || !ocrCache.has(sessionId)) {
      return res.status(400).json({ error: 'Invalid or expired session' })
    }

    const { ocrResults, imageCount, pageNames } = ocrCache.get(sessionId)
    
    console.log('Generating test cases with corrected labels...')
    const testCases = await aiService.generateTestCasesWithCorrections(ocrResults, imageCount, correctedElements, pageNames)
    
    testCases._sessionId = sessionId
    console.log('AI generated test cases with corrections successfully!')
    res.json(testCases)
  } catch (error) {
    console.error('Error generating test cases with corrections:', error)
    res.status(500).json({ error: 'Failed to generate test cases with corrections' })
  }
})

// Regenerate test cases endpoint
app.post('/api/regenerate-testcases', async (req, res) => {
  try {
    const { sessionId } = req.body
    
    if (!sessionId || !ocrCache.has(sessionId)) {
      return res.status(400).json({ error: 'Invalid or expired session' })
    }

    const { ocrResults, imageCount, pageNames } = ocrCache.get(sessionId)
    
    console.log('Regenerating test cases with Claude AI...')
    const testCases = await aiService.generateTestCases(ocrResults, imageCount, true, pageNames)
    
    console.log('AI regenerated test cases successfully!')
    res.json(testCases)
  } catch (error) {
    console.error('Error regenerating test cases:', error)
    res.status(500).json({ error: 'Failed to regenerate test cases' })
  }
})

// Download endpoints
app.post('/api/download/docx', async (req, res) => {
  try {
    const testCases = req.body

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: "Generated Test Cases",
                bold: true,
                size: 32,
              }),
            ],
          }),
          new Paragraph({ text: "" }),

          // Generate content based on format
          ...(testCases.allTestCases ?
            // New format with detailed test cases
            testCases.allTestCases.flatMap((testCase, index) => [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Test Case TC-${String(index + 1).padStart(3, '0')}`,
                    bold: true,
                    size: 16,
                    color: "366092"
                  }),
                ],
                spacing: { before: 200, after: 100 }
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Type: ",
                    bold: true,
                    size: 12,
                  }),
                  new TextRun({
                    text: testCase.type,
                    size: 12,
                    color: "0066CC"
                  }),
                ],
                spacing: { after: 50 }
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Title: ",
                    bold: true,
                    size: 12,
                  }),
                  new TextRun({
                    text: testCase.title,
                    size: 12,
                  }),
                ],
                spacing: { after: 50 }
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Test Data:",
                    bold: true,
                    size: 12,
                  }),
                ],
                spacing: { after: 30 }
              }),
              // Test Data section with bullets
              ...(testCase.testData || 'Standard test data').replace(/\\n/g, '\n').split('\n').filter(line => line.trim()).map(line => 
                new Paragraph({
                  text: line.trim().startsWith('•') ? line : `• ${line}`,
                  spacing: { after: 30 }
                })
              ),
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Test Steps:",
                    bold: true,
                    size: 12,
                  }),
                ],
                spacing: { before: 50, after: 30 }
              }),
              // Test Steps section with bullets/numbers
              ...(testCase.testSteps || testCase.description || '').replace(/\\n/g, '\n').split('\n').filter(line => line.trim()).map(line => 
                new Paragraph({
                  text: line.trim().match(/^\d+\./) || line.trim().startsWith('•') ? line : `• ${line}`,
                  spacing: { after: 30 }
                })
              ),
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Expected Results:",
                    bold: true,
                    size: 12,
                  }),
                ],
                spacing: { before: 50, after: 30 }
              }),
              // Expected Results section with bullets
              ...(testCase.expectedResults || 'Test should complete successfully').replace(/\\n/g, '\n').split('\n').filter(line => line.trim()).map(line => 
                new Paragraph({
                  text: line.trim().startsWith('•') ? line : `• ${line}`,
                  spacing: { after: 30 }
                })
              ),
              new Paragraph({
                children: [
                  new TextRun({
                    text: "─".repeat(80),
                    color: "CCCCCC"
                  }),
                ],
                spacing: { after: 200 }
              }),
            ])
            :
            // Legacy format
            [
              // Target/Functional Test Cases
              ...(testCases.target || testCases.functional || []).length > 0 ? [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "Functional Test Cases",
                      bold: true,
                      size: 24,
                    }),
                  ],
                }),
                ...(testCases.target || testCases.functional || []).map(testCase =>
                  new Paragraph({ text: `• ${testCase}` })
                ),
                new Paragraph({ text: "" }),
              ] : [],

              // Integration Test Cases
              ...(testCases.integration || []).length > 0 ? [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "Integration Test Cases",
                      bold: true,
                      size: 24,
                    }),
                  ],
                }),
                ...testCases.integration.map(testCase =>
                  new Paragraph({ text: `• ${testCase}` })
                ),
                new Paragraph({ text: "" }),
              ] : [],

              // System/End-to-End Test Cases
              ...(testCases.system || testCases.endToEnd || []).length > 0 ? [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "End-to-End Test Cases",
                      bold: true,
                      size: 24,
                    }),
                  ],
                }),
                ...(testCases.system || testCases.endToEnd || []).map(testCase =>
                  new Paragraph({ text: `• ${testCase}` })
                ),
                new Paragraph({ text: "" }),
              ] : [],

              // Edge Cases
              ...(testCases.edge || []).length > 0 ? [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "Edge Cases",
                      bold: true,
                      size: 24,
                    }),
                  ],
                }),
                ...testCases.edge.map(testCase =>
                  new Paragraph({ text: `• ${testCase}` })
                ),
                new Paragraph({ text: "" }),
              ] : [],

              // Negative Test Cases
              ...(testCases.negative || []).length > 0 ? [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "Negative Test Cases",
                      bold: true,
                      size: 24,
                    }),
                  ],
                }),
                ...testCases.negative.map(testCase =>
                  new Paragraph({ text: `• ${testCase}` })
                ),
                new Paragraph({ text: "" }),
              ] : [],

              // Positive Test Cases (legacy)
              ...(testCases.positive || []).length > 0 ? [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "Positive Test Cases",
                      bold: true,
                      size: 24,
                    }),
                  ],
                }),
                ...testCases.positive.map(testCase =>
                  new Paragraph({ text: `• ${testCase}` })
                ),
              ] : [],
            ].flat()
          )
        ],
      }],
    })

    const buffer = await Packer.toBuffer(doc)

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    res.setHeader('Content-Disposition', 'attachment; filename=test-cases.docx')
    res.send(buffer)
  } catch (error) {
    console.error('Error generating DOCX:', error)
    res.status(500).json({ error: 'Failed to generate DOCX' })
  }
})

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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})