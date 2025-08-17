require('dotenv').config()
const express = require('express')
const cors = require('cors')
const multer = require('multer')
const Tesseract = require('tesseract.js')
const { Document, Packer, Paragraph, TextRun } = require('docx')
const ExcelJS = require('exceljs')
const fs = require('fs')
const AIService = require('./aiService')

const app = express()
const PORT = process.env.SERVER_PORT || 3001

// Initialize AI Service
const aiService = new AIService()

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

// Mock AI response function
function generateMockTestCases(ocrResults) {
  const mockTestCases = {
    target: [
      "Verify that the login form accepts valid username and password",
      "Verify that the main navigation menu displays all required sections",
      "Verify that the search functionality returns relevant results",
      "Verify that user can successfully submit the contact form",
      "Verify that the dashboard displays user-specific information"
    ],
    integration: [
      "Verify that user authentication integrates properly with the database",
      "Verify that payment processing integrates with third-party payment gateway",
      "Verify that email notifications are sent after form submission",
      "Verify that user data synchronizes across different modules",
      "Verify that API calls return expected responses"
    ],
    system: [
      "Verify that the application handles concurrent user sessions",
      "Verify that the system performs well under normal load conditions",
      "Verify that data backup and recovery processes work correctly",
      "Verify that the application maintains security standards",
      "Verify that system logs capture all critical events"
    ],
    edge: [
      "Verify application behavior when network connection is lost",
      "Verify system response when maximum file size is exceeded",
      "Verify handling of special characters in input fields",
      "Verify application behavior at exactly midnight",
      "Verify system response when database connection fails"
    ],
    positive: [
      "User can successfully log in with correct credentials",
      "User can navigate through all application sections smoothly",
      "User can save and retrieve data successfully",
      "User receives confirmation messages for successful actions",
      "User can access help documentation when needed"
    ],
    negative: [
      "User cannot log in with incorrect credentials",
      "User cannot submit forms with missing required fields",
      "User cannot access restricted areas without proper permissions",
      "User cannot upload files exceeding size limits",
      "User cannot perform actions without proper authentication"
    ]
  }

  // Add OCR-specific test cases based on detected text
  if (ocrResults && ocrResults.length > 0) {
    const detectedText = ocrResults.join(' ').toLowerCase()

    if (detectedText.includes('login') || detectedText.includes('sign in')) {
      mockTestCases.target.unshift("Verify that the login button is clickable and functional")
      mockTestCases.negative.unshift("Verify that login fails with empty username field")
    }

    if (detectedText.includes('search')) {
      mockTestCases.target.unshift("Verify that the search box accepts text input")
      mockTestCases.edge.unshift("Verify search behavior with extremely long search queries")
    }

    if (detectedText.includes('submit') || detectedText.includes('send')) {
      mockTestCases.positive.unshift("User can successfully submit the form with valid data")
      mockTestCases.negative.unshift("Form submission fails with invalid data format")
    }
  }

  return mockTestCases
}

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

// Store OCR results temporarily for regeneration
const ocrCache = new Map()

// Routes
app.post('/api/generate-testcases', upload.any(), async (req, res) => {
  try {
    const files = req.files
    if (!files || files.length < 3) {
      return res.status(400).json({ error: 'At least 3 images required' })
    }

    console.log(`Processing ${files.length} images...`)

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

    // Check if this is just OCR processing or full generation
    if (req.body.ocrOnly === 'true') {
      // Return OCR results for user review
      const sessionId = Date.now().toString()
      ocrCache.set(sessionId, { ocrResults, imageCount: files.length })
      
      const detectedElements = ocrResults.map((text, index) => {
        // Extract potential UI elements from OCR text
        const lines = text.split('\n').filter(line => line.trim().length > 0)
        return {
          screenshotIndex: index,
          detectedTexts: lines.map((line, lineIndex) => ({
            id: `${index}-${lineIndex}`,
            text: line.trim(),
            label: '', // User will fill this
            type: 'unknown' // User will specify
          }))
        }
      })

      return res.json({
        sessionId,
        detectedElements,
        requiresReview: true
      })
    }

    // Generate test cases using Claude AI
    const forceRegenerate = req.body.regenerate === 'true'
    console.log(`Generating test cases with Claude AI... ${forceRegenerate ? '(forced regeneration)' : ''}`)
    const testCases = await aiService.generateTestCases(ocrResults, files.length, forceRegenerate)

    // Store OCR results for potential regeneration
    const sessionId = Date.now().toString()
    ocrCache.set(sessionId, { ocrResults, imageCount: files.length })
    testCases._sessionId = sessionId

    console.log('AI generated test cases successfully!')
    res.json(testCases)
  } catch (error) {
    console.error('Error generating test cases:', error)

    // Fallback to mock test cases if AI fails
    console.log('Falling back to mock test cases...')
    try {
      const fallbackTestCases = generateMockTestCases(ocrResults || [])
      res.json({
        ...fallbackTestCases,
        _fallback: true,
        _message: 'AI service unavailable, using fallback test cases'
      })
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError)
      res.status(500).json({ error: 'Failed to generate test cases' })
    }
  }
})

// Generate test cases with corrected labels
app.post('/api/generate-with-corrections', async (req, res) => {
  try {
    const { sessionId, correctedElements } = req.body
    
    if (!sessionId || !ocrCache.has(sessionId)) {
      return res.status(400).json({ error: 'Invalid or expired session' })
    }

    const { ocrResults, imageCount } = ocrCache.get(sessionId)
    
    console.log('Generating test cases with corrected labels...')
    const testCases = await aiService.generateTestCasesWithCorrections(ocrResults, imageCount, correctedElements)
    
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

    const { ocrResults, imageCount } = ocrCache.get(sessionId)
    
    console.log('Regenerating test cases with Claude AI...')
    const testCases = await aiService.generateTestCases(ocrResults, imageCount, true)
    
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