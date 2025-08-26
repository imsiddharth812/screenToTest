const Anthropic = require('@anthropic-ai/sdk')
const fs = require('fs')
const path = require('path')

class UnifiedAIService {
    constructor() {
        this.anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        })
        this.testCaseCache = new Map()
    }

    async generateTestCases(screenshotPaths, ocrResults = [], pageNames = [], forceRegenerate = false) {
        try {
            // Create cache key
            const cacheKey = this.createCacheKey(screenshotPaths, ocrResults, pageNames)
            
            // Check cache for consistent results (unless forced regeneration)
            if (!forceRegenerate && this.testCaseCache.has(cacheKey)) {
                console.log('Returning cached unified AI test cases')
                return this.testCaseCache.get(cacheKey)
            }

            // Prepare images for analysis
            const imageMessages = await this.prepareImageMessages(screenshotPaths, pageNames)
            
            const prompt = this.buildUnifiedPrompt(ocrResults, pageNames, screenshotPaths.length)

            console.log('Sending request to Claude for Unified AI Analysis...')
            const response = await this.makeRequestWithRetry({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 8000,
                temperature: forceRegenerate ? 0.2 : 0.05,
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: prompt
                            },
                            ...imageMessages
                        ]
                    }
                ]
            })

            const content = response.content[0].text
            console.log('Received response from Claude for Unified AI Analysis')
            const testCases = this.parseTestCases(content)
            
            // Cache the result
            this.testCaseCache.set(cacheKey, testCases)
            
            return testCases
        } catch (error) {
            console.error('Unified AI Service Error:', error)
            throw error
        }
    }

    async prepareImageMessages(screenshotPaths, pageNames) {
        const imageMessages = []
        
        for (let i = 0; i < screenshotPaths.length; i++) {
            const screenshotPath = screenshotPaths[i]
            const pageName = pageNames[i] || `Page ${i + 1}`
            
            try {
                // Read image file
                const imageBuffer = fs.readFileSync(screenshotPath)
                const base64Image = imageBuffer.toString('base64')
                
                // Determine image type
                const ext = path.extname(screenshotPath).toLowerCase()
                const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg'
                
                imageMessages.push({
                    type: 'text',
                    text: `\\n--- ${pageName} (Screenshot ${i + 1}) ---`
                })
                
                imageMessages.push({
                    type: 'image',
                    source: {
                        type: 'base64',
                        media_type: mimeType,
                        data: base64Image
                    }
                })
            } catch (error) {
                console.error(`Error reading screenshot ${screenshotPath}:`, error)
                imageMessages.push({
                    type: 'text',
                    text: `\\n--- ${pageName} (Screenshot ${i + 1}) - IMAGE READ ERROR ---`
                })
            }
        }
        
        return imageMessages
    }

    buildUnifiedPrompt(ocrResults, pageNames, imageCount) {
        const detectedText = ocrResults.length > 0 ? 
            ocrResults.map((text, index) => {
                const pageName = pageNames[index] || `Page ${index + 1}`
                return `--- ${pageName} ---\\n${text}`
            }).join('\\n\\n') : 'No OCR text provided - using visual analysis only.'

        const pageFlow = pageNames.length > 0 
            ? pageNames.map((name, index) => `${index + 1}. ${name}`).join('\\n')
            : Array.from({length: imageCount}, (_, i) => `${i + 1}. Page ${i + 1}`).join('\\n')

        // Detect application domain from page names and OCR content
        const domainContext = this.detectApplicationDomain(pageNames, ocrResults)
        
        return `You are an ULTIMATE QA engineer with SUPREME TESTING CAPABILITIES combining OCR text analysis, advanced visual analysis, and comprehensive business logic understanding. You have access to both extracted text content AND actual application screenshots to generate the MOST COMPREHENSIVE and THOROUGH test suite possible.

**SUPREME UNIFIED ANALYSIS APPROACH:**
You have BOTH OCR-extracted text content AND visual screenshots. Use BOTH capabilities together to create the most comprehensive test suite:

**DUAL ANALYSIS CAPABILITIES:**
- Extract business logic, data fields, form labels, and functional flows from OCR text
- Identify UI elements, buttons, forms, navigation paths, and visual layout from screenshots
- Understand complete user workflows combining textual understanding with visual interface navigation
- Detect all interactive elements through both text detection and visual confirmation
- Validate business processes using both textual content and visual interface patterns

**INTELLIGENT APPLICATION ANALYSIS:**
Detected Application Domain: ${domainContext.domain}
Key Business Functions: ${domainContext.functions.join(', ')}
Focus Areas for Testing: ${domainContext.testAreas.join(', ')}

**APPLICATION CONTENT ANALYSIS:**
${detectedText}

**USER WORKFLOW SEQUENCE:**
${pageFlow}

**IMPORTANT CONTEXT:** The screenshots above represent the EXACT SEQUENCE of the user workflow/application flow combined with OCR text analysis. This represents the natural progression through the application.

**PRIMARY TEST TYPES TO GENERATE (Ultimate Comprehensive Analysis):**
1. **End-to-End Tests**: Complete user workflows from start to finish using both text understanding and visual interface knowledge
2. **Integration Tests**: Cross-module functionality testing using text analysis combined with visual identification of interface connections
3. **Functional Tests**: Business functionality testing with dual validation using both OCR content and visual confirmation

**SUPREME COMPREHENSIVE TEST COVERAGE AREAS:**
1. **Complete Business Workflow Testing**: End-to-end processes using both text understanding and visual flow confirmation
2. **Advanced Integration Testing**: Cross-module interactions using text logic and visual interface validation
3. **Comprehensive Form and Data Testing**: All input fields, dropdowns, and data entry using both OCR and visual analysis
4. **Error Handling and Edge Cases**: Invalid inputs with recovery steps using text-based messages and visual error states
5. **User Journey Completion**: Multi-step processes using text logic and visual navigation patterns
6. **Business Rules and Logic Validation**: Functional validation using text rules and visual feedback confirmation
7. **Complete Navigation Testing**: Workflow navigation using text content and visual interface flow
8. **Data Processing and Validation**: Data accuracy using text content and visual presentation verification
9. **Process Completion Verification**: Complete workflows using text logic and visual completion confirmation
10. **Security and Permission Testing**: Access control using both textual indicators and visual security elements

**CRITICAL SUCCESS REQUIREMENTS:**
1. **Maximum Coverage**: Every test case must validate business functionality using both text identification and visual element identification
2. **Complete Process Testing**: Include steps to complete ALL business processes using both OCR-identified content and visually identified components
3. **Advanced Business Logic**: Validate ALL business rules and functionality using both textual and visual interface understanding
4. **Cross-Screen Workflow Testing**: Test ALL business workflows that span multiple screens using dual analysis
5. **Edge Case Coverage**: Include negative testing, error scenarios, and boundary conditions

**COMPREHENSIVE TEST CASE REQUIREMENTS:**
- Use dual analysis to identify ALL clickable elements, forms, and navigation paths
- Reference specific UI elements using BOTH textual descriptions AND visual descriptions
- Create detailed test steps using BOTH OCR-identified content AND visually observed components
- Test complete business functionality using combined understanding
- Generate comprehensive user workflows based on both textual and visual analysis
- Validate ALL business processes using both text patterns and visual UI patterns

**ULTIMATE TEST CASE STRUCTURE:**
Each test case must include:
- "type": One of (End-to-End, Integration, or Functional)
- "title": Comprehensive business-focused title describing the complete workflow
- "preconditions": EXTREMELY DETAILED setup requirements and prerequisites
- "testSteps": COMPLETE step-by-step flow from first action to final result (numbered format)
- "testData": Comprehensive realistic test data with specific values (bullet format)
- "expectedResults": Detailed expected outcomes with specific success criteria (bullet format)

**CRITICAL INSTRUCTIONS FOR MAXIMUM TEST GENERATION:**
- Generate MINIMUM 20-25 DETAILED COMPREHENSIVE test cases for COMPLETE feature coverage achieving 90-95% testing coverage
- Each test case must focus on COMPLETE BUSINESS FUNCTIONALITY using both text understanding and visual interface analysis
- Always use page names in test steps: "${pageNames[0] || 'Page 1'}", "${pageNames[1] || 'Page 2'}", etc.
- Write test cases for NOVICE TESTERS with extremely detailed, step-by-step instructions
- Reference specific UI elements identified through BOTH OCR text content AND visual screenshots
- Include detailed preconditions/prerequisites for each test case
- Focus on COMPLETE BUSINESS LOGIC and FUNCTIONAL VALIDATION
- Create comprehensive end-to-end business workflows with detailed navigation steps
- **CRITICAL: FOLLOW COMPLETE WORKFLOW** - Every test case must start from the very first action and continue through to the final result
- Each test step must logically flow into the next step, creating a complete sequence
- Include BOTH positive testing (happy paths) AND negative testing (error scenarios, edge cases)
- Test ALL major features, workflows, and business processes visible in the application
- Ensure comprehensive coverage of ALL functional areas for maximum business value

**ENHANCED COVERAGE REQUIREMENTS:**
- Test ALL form submissions with various data combinations
- Test ALL navigation paths and menu interactions
- Test ALL data processing and validation scenarios
- Test ALL error conditions and recovery workflows
- Test ALL user permission levels and access scenarios
- Test ALL integration points between different application modules
- Test ALL business rule validations and calculations
- Test ALL workflow completion scenarios from start to finish

IMPORTANT: Your response must be a single, valid JSON object containing a 'testCases' array. Do not include any explanatory text, markdown formatting, or additional content outside of the JSON structure.

Example response format:
{
  "testCases": [
    {
      "type": "End-to-End",
      "title": "Complete comprehensive business workflow test utilizing both OCR text analysis and visual interface validation",
      "preconditions": "• System accessible with proper authentication\\n• Test data prepared based on both OCR-detected fields and visual elements\\n• All required permissions granted for complete workflow testing",
      "testSteps": "1. Navigate to application entry point using both OCR-detected navigation text and visual interface elements\\n2. Complete authentication using OCR-identified login fields with visual confirmation of field states\\n3. Access main workflow area using both text-based navigation and visual interface confirmation\\n4. Execute complete business process using dual OCR+Visual element identification\\n5. Validate all results using both textual success indicators and visual confirmation elements",
      "testData": "• Username from OCR field analysis: testuser@example.com\\n• Password for visual field interaction: SecurePass123\\n• Business data from dual analysis: comprehensive test values\\n• Expected success indicators: both text and visual confirmations",
      "expectedResults": "• OCR-detected success messages display correctly\\n• Visual confirmation elements appear in correct positions\\n• Complete business workflow executes successfully\\n• All functional and visual validation criteria are met\\n• Business process completes with full data integrity"
    }
  ]
}`
    }

    parseTestCases(content) {
        try {
            // Clean the content to extract JSON
            let jsonStr = content.trim()

            // If the content contains markdown, try to extract just the JSON
            if (jsonStr.includes('```')) {
                const matches = jsonStr.match(/```(?:json)?\\n?([\\s\\S]*?)```/g)
                if (matches && matches.length > 0) {
                    jsonStr = matches.map(match => {
                        return match.replace(/```(?:json)?\\n?/g, '').replace(/```\\n?/g, '')
                    }).join(',')
                    if (matches.length > 1) {
                        jsonStr = `{"testCases": ${jsonStr}}`
                    }
                }
            }

            // Find the outermost JSON object
            const jsonStart = jsonStr.indexOf('{')
            const jsonEnd = jsonStr.lastIndexOf('}') + 1

            if (jsonStart !== -1 && jsonEnd > jsonStart) {
                jsonStr = jsonStr.substring(jsonStart, jsonEnd)
            }

            const parsed = JSON.parse(jsonStr)

            if (!parsed.testCases || !Array.isArray(parsed.testCases)) {
                throw new Error('Invalid test case structure - missing testCases array')
            }

            // Validate and normalize test cases
            parsed.testCases.forEach((testCase) => {
                // Ensure all fields are strings
                testCase.preconditions = String(testCase.preconditions || 'System setup with comprehensive data and interface requirements')
                testCase.testSteps = String(testCase.testSteps || testCase.description || 'Comprehensive test steps not specified')
                testCase.testData = String(testCase.testData || 'Comprehensive test data sets')
                testCase.expectedResults = String(testCase.expectedResults || 'Comprehensive validation with complete functional confirmation')
                testCase.title = String(testCase.title || 'Comprehensive Test Case')
                testCase.type = String(testCase.type || 'End-to-End')
                
                // Format test steps and expected results
                testCase.testSteps = this.formatToNumberedList(testCase.testSteps)
                testCase.expectedResults = this.formatToBulletList(testCase.expectedResults)
                testCase.testData = this.formatToBulletList(testCase.testData)
            })

            const result = {
                allTestCases: parsed.testCases
            }

            // Create categorized version
            const categorized = {
                functional: [],
                endToEnd: [],
                integration: [],
                ui: []
            }

            parsed.testCases.forEach(testCase => {
                const type = testCase.type ? testCase.type.toLowerCase().replace(/[-\\s]/g, '') : 'functional'
                const formattedCase = `${testCase.title}: ${testCase.testSteps}`

                if (categorized[type]) {
                    categorized[type].push(formattedCase)
                } else {
                    categorized.functional.push(formattedCase)
                }
            })

            return {
                ...result,
                ...categorized
            }

        } catch (error) {
            console.error('Failed to parse Unified AI response:', error)
            console.error('Raw content:', content)
            throw new Error('Failed to generate test cases: AI response could not be parsed. Please try again.')
        }
    }

    detectApplicationDomain(pageNames, ocrResults) {
        const allText = [...pageNames, ...ocrResults].join(' ').toLowerCase()
        
        // Domain detection patterns
        const domains = {
            'E-commerce/Shopping': {
                keywords: ['product', 'cart', 'checkout', 'payment', 'order', 'shipping', 'price', 'buy', 'purchase', 'catalog', 'inventory', 'store'],
                functions: ['Product browsing', 'Shopping cart management', 'Payment processing', 'Order tracking'],
                testAreas: ['Purchase workflow', 'Payment security', 'Inventory management', 'User account']
            },
            'CRM/Customer Management': {
                keywords: ['client', 'customer', 'case', 'contact', 'lead', 'opportunity', 'account', 'relationship', 'sales', 'pipeline'],
                functions: ['Client management', 'Case tracking', 'Contact management', 'Sales pipeline'],
                testAreas: ['Client data integrity', 'Case workflow', 'Communication tracking', 'Reporting']
            },
            'Banking/Financial': {
                keywords: ['account', 'balance', 'transfer', 'transaction', 'payment', 'deposit', 'withdrawal', 'loan', 'credit', 'debit', 'finance'],
                functions: ['Account management', 'Money transfer', 'Transaction history', 'Payment processing'],
                testAreas: ['Security', 'Transaction accuracy', 'Account balance', 'Compliance']
            },
            'Project Management': {
                keywords: ['project', 'task', 'milestone', 'deadline', 'team', 'assignment', 'progress', 'status', 'timeline', 'resource'],
                functions: ['Project tracking', 'Task management', 'Team collaboration', 'Resource allocation'],
                testAreas: ['Project workflow', 'Task assignment', 'Progress tracking', 'Team communication']
            },
            'Healthcare/Medical': {
                keywords: ['patient', 'appointment', 'medical', 'doctor', 'treatment', 'prescription', 'diagnosis', 'health', 'clinic', 'hospital'],
                functions: ['Patient management', 'Appointment scheduling', 'Medical records', 'Treatment tracking'],
                testAreas: ['Patient data security', 'Appointment workflow', 'Medical compliance', 'Record integrity']
            }
        }

        // Find best matching domain
        let bestMatch = { 
            domain: 'General Business Application', 
            score: 0, 
            functions: ['Advanced data management', 'Complex user workflows', 'Multi-modal business processes'], 
            testAreas: ['Comprehensive user experience', 'Advanced data integrity', 'Complex workflow completion'] 
        }
        
        Object.entries(domains).forEach(([domainName, domainData]) => {
            const score = domainData.keywords.reduce((count, keyword) => {
                return count + (allText.includes(keyword) ? 1 : 0)
            }, 0)
            
            if (score > bestMatch.score) {
                bestMatch = {
                    domain: domainName,
                    score,
                    functions: domainData.functions,
                    testAreas: domainData.testAreas
                }
            }
        })

        return bestMatch
    }

    createCacheKey(screenshotPaths, ocrResults, pageNames) {
        const crypto = require('crypto')
        const content = JSON.stringify({ 
            paths: screenshotPaths.map(p => path.basename(p)),
            ocr: ocrResults,
            pageNames 
        })
        return crypto.createHash('md5').update(content).digest('hex')
    }

    async makeRequestWithRetry(requestParams, maxRetries = 3) {
        let lastError
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`Unified AI attempt ${attempt}/${maxRetries}`)
                const response = await this.anthropic.messages.create(requestParams)
                console.log('Unified AI request successful')
                return response
            } catch (error) {
                lastError = error
                console.log(`Unified AI attempt ${attempt} failed:`, error.status, error.message)
                
                if (error.status === 529 && attempt < maxRetries) {
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
                    console.log(`Waiting ${delay}ms before retry...`)
                    await new Promise(resolve => setTimeout(resolve, delay))
                    continue
                }
                
                throw error
            }
        }
        
        throw lastError
    }

    formatToNumberedList(text) {
        if (!text || typeof text !== 'string') return text
        
        // If already numbered, return as is
        if (text.match(/^\d+\.\s/)) return text
        
        // Split by newlines and common delimiters, but NOT by existing numbers
        const lines = text.split(/\n|[,;]/)
            .map(line => line.trim())
            .filter(line => line.length > 0)
        
        // Convert to numbered list
        return lines.map((line, index) => `${index + 1}. ${line}`).join('\n')
    }

    formatToBulletList(text) {
        if (!text || typeof text !== 'string') return text
        
        // Split by common delimiters and clean up
        const lines = text.split(/[,;]|\\n/)
            .map(line => line.trim())
            .filter(line => line.length > 0)
        
        // If already has bullets, return as is
        if (text.includes('•') || text.includes('-') || text.includes('*')) return text
        
        // Convert to bullet list
        return lines.map(line => `• ${line}`).join('\\n')
    }
}

module.exports = UnifiedAIService