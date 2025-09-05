const Anthropic = require('@anthropic-ai/sdk')
const OpenAI = require('openai')
const fs = require('fs')
const path = require('path')

class UnifiedAIService {
    constructor() {
        this.anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        })
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        })
        this.testCaseCache = new Map()
    }

    async generateTestCases(screenshotPaths, ocrResults = [], pageNames = [], forceRegenerate = false, scenarioContext = {}, aiModel = 'claude') {
        try {
            // Create cache key with model info
            const cacheKey = this.createCacheKey(screenshotPaths, ocrResults, pageNames, aiModel)
            
            // Check cache for consistent results (unless forced regeneration)
            if (!forceRegenerate && this.testCaseCache.has(cacheKey)) {
                console.log(`Returning cached ${aiModel} test cases`)
                return this.testCaseCache.get(cacheKey)
            }

            let testCases
            if (aiModel === 'gpt-4-vision') {
                testCases = await this.generateTestCasesWithOpenAI(screenshotPaths, ocrResults, pageNames, scenarioContext, forceRegenerate)
            } else {
                testCases = await this.generateTestCasesWithClaude(screenshotPaths, ocrResults, pageNames, scenarioContext, forceRegenerate)
            }
            
            // Cache the result
            this.testCaseCache.set(cacheKey, testCases)
            
            return testCases
        } catch (error) {
            console.error(`Unified AI Service Error (${aiModel}):`, error)
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

    buildUnifiedPrompt(ocrResults, pageNames, imageCount, scenarioContext = {}) {
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
        
        // Get intent-based prompt section
        const intentSection = this.buildIntentBasedPrompt(scenarioContext)
        
        // Build context sections from scenario
        const contextSections = this.buildContextSections(scenarioContext)
        
        return `You are an EXPERT QA ENGINEER specializing in manual testing with deep understanding of functional testing methodologies. You have access to both OCR-extracted text content AND visual screenshots to generate highly targeted, manual tester-friendly test cases.

**TESTING APPROACH:**
You combine OCR text analysis with visual screenshot analysis to create comprehensive, practical test cases that manual testers can easily execute.

${intentSection}

**APPLICATION ANALYSIS:**
Detected Application Domain: ${domainContext.domain}
Key Business Functions: ${domainContext.functions.join(', ')}
Focus Areas for Testing: ${domainContext.testAreas.join(', ')}

**APPLICATION CONTENT ANALYSIS:**
${detectedText}

**USER WORKFLOW SEQUENCE:**
${pageFlow}

${contextSections}

**DUAL ANALYSIS CAPABILITIES:**
- Extract business logic, data fields, form labels, and functional flows from OCR text
- Identify UI elements, buttons, forms, navigation paths, and visual layout from screenshots
- Understand complete user workflows combining textual understanding with visual interface navigation
- Detect all interactive elements through both text detection and visual confirmation
- Validate business processes using both textual content and visual interface patterns

**MANUAL TESTING FOCUS:**
- Create test cases that manual testers can execute step-by-step
- Include detailed preconditions and setup instructions
- Provide specific test data values and expected results
- Focus on practical, executable test scenarios
- Ensure comprehensive coverage while remaining manageable

**TEST CASE STRUCTURE:**
Each test case must include:
- "type": One of (End-to-End, Integration, or Functional)
- "title": Clear, descriptive title focusing on the specific functionality being tested
- "preconditions": Detailed setup requirements and prerequisites
- "testSteps": Complete step-by-step instructions (numbered format)
- "testData": Realistic test data with specific values (bullet format)
- "expectedResults": Detailed expected outcomes with specific success criteria (bullet format)

**CRITICAL INSTRUCTIONS:**
- Generate comprehensive test cases based on testing intent and coverage level
- Always use page names in test steps: "${pageNames[0] || 'Page 1'}", "${pageNames[1] || 'Page 2'}", etc.
- Write test cases for MANUAL TESTERS with clear, step-by-step instructions
- Reference specific UI elements identified through both OCR text content AND visual screenshots
- Include detailed preconditions/prerequisites for each test case
- Create comprehensive workflows with detailed navigation steps
- Include both positive testing (happy paths) AND negative testing (error scenarios, edge cases)
- Test all major features, workflows, and business processes visible in the application

IMPORTANT: Your response must be a single, valid JSON object containing a 'testCases' array. Do not include any explanatory text, markdown formatting, or additional content outside of the JSON structure.

Example response format:
{
  "testCases": [
    {
      "type": "Functional",
      "title": "Login form validation with valid credentials",
      "preconditions": "• Application is accessible\\n• User is logged in to the application",
      "testSteps": "1. Navigate to ${pageNames[0] || 'Page 1'}\\n2. Locate username field\\n3. Enter valid username\\n4. Locate password field\\n5. Enter valid password\\n6. Click login button\\n7. Verify successful login",
      "testData": "• Username: testuser@example.com\\n• Password: SecurePass123",
      "expectedResults": "• User is successfully authenticated\\n• Redirected to dashboard or main application\\n• Success message displayed\\n• User session is established"
    }
  ]
}`
    }

    buildIntentBasedPrompt(scenarioContext) {
        const intent = scenarioContext.testing_intent || 'comprehensive'
        const coverage = scenarioContext.coverage_level || 'comprehensive'
        
        // Ensure testTypes is always an array
        let testTypes = scenarioContext.test_types || ['positive', 'negative', 'edge_cases']
        if (typeof testTypes === 'string') {
            try {
                testTypes = JSON.parse(testTypes)
            } catch (e) {
                testTypes = ['positive', 'negative', 'edge_cases']
            }
        }
        if (!Array.isArray(testTypes)) {
            testTypes = ['positive', 'negative', 'edge_cases']
        }
        
        const intentPrompts = {
            'form-validation': `**PRIMARY TESTING INTENT: FORM VALIDATION FOCUS**
This scenario specifically focuses on comprehensive form validation testing including:
- Input field validation (required fields, data types, format validation)
- Error message validation and display
- Field interactions and dependencies
- Data sanitization and security validation
- Form submission workflows and error handling
- Field boundary testing and edge cases
- User experience during form completion

Generate test cases that thoroughly validate ALL form elements, input validations, error conditions, and user interactions with forms.`,

            'user-journey': `**PRIMARY TESTING INTENT: USER JOURNEY TESTING**
This scenario focuses on complete end-to-end user workflows including:
- Multi-step process completion from start to finish
- Navigation between different pages and sections
- State persistence across the journey
- User experience throughout the complete workflow
- Process interruption and recovery scenarios
- Data flow across multiple steps

Generate test cases that validate complete user journeys and multi-step workflows.`,

            'integration': `**PRIMARY TESTING INTENT: FEATURE INTEGRATION TESTING**
This scenario focuses on how different components and features work together:
- Data exchange between different modules
- Component interactions and dependencies
- Cross-functional workflows
- System integration points
- Feature interdependencies

Generate test cases that validate how features integrate and work together.`,

            'business-logic': `**PRIMARY TESTING INTENT: BUSINESS LOGIC VALIDATION**
This scenario focuses on validating business rules and logic:
- Calculation accuracy and business rule enforcement
- Decision-making processes and logic flows
- Data processing and transformation
- Business process validation
- Rule-based behavior testing

Generate test cases that validate business logic and rule implementation.`,

            'comprehensive': `**PRIMARY TESTING INTENT: COMPREHENSIVE TESTING**
This scenario requires complete coverage including:
- Functional validation of all features
- End-to-end workflow testing
- Integration between components
- Error handling and edge cases
- User experience validation

Generate comprehensive test cases covering all aspects of the functionality.`
        }

        const coveragePrompts = {
            'essential': 'Focus on core happy path scenarios and critical functionality only.',
            'comprehensive': 'Include both happy path and common edge cases for thorough coverage.',
            'exhaustive': 'Generate comprehensive coverage including rare edge cases and extensive boundary testing.'
        }

        const testTypePrompts = {
            'positive': 'Include positive testing scenarios with valid inputs and expected flows',
            'negative': 'Include negative testing scenarios with invalid inputs and error conditions',
            'edge_cases': 'Include edge case testing with boundary values and unusual scenarios'
        }

        const selectedTypes = testTypes.map(type => testTypePrompts[type]).filter(Boolean)

        return `${intentPrompts[intent] || intentPrompts.comprehensive}

**COVERAGE LEVEL: ${coverage.toUpperCase()}**
${coveragePrompts[coverage]}

**TEST TYPES TO INCLUDE:**
${selectedTypes.map(type => `- ${type}`).join('\\n')}

**ESTIMATED TEST CASES:** Generate approximately ${this.getEstimatedTestCount(intent, coverage, testTypes.length)} comprehensive test cases based on this intent and coverage level.`
    }

    buildContextSections(scenarioContext) {
        let sections = []
        

        if (scenarioContext.user_story) {
            sections.push(`**USER STORY:**
${scenarioContext.user_story}`)
        }

        if (scenarioContext.acceptance_criteria) {
            sections.push(`**ACCEPTANCE CRITERIA:**
${scenarioContext.acceptance_criteria}`)
        }

        if (scenarioContext.business_rules) {
            sections.push(`**BUSINESS RULES:**
${scenarioContext.business_rules}`)
        }

        if (scenarioContext.edge_cases) {
            sections.push(`**EDGE CASES TO CONSIDER:**
${scenarioContext.edge_cases}`)
        }

        if (scenarioContext.test_environment) {
            sections.push(`**TEST ENVIRONMENT REQUIREMENTS:**
${scenarioContext.test_environment}`)
        }

        const contextString = sections.join('\\n\\n')
        
        return contextString
    }

    getEstimatedTestCount(intent, coverage, testTypeCount) {
        const baseMultipliers = {
            'form-validation': 15,
            'user-journey': 8,
            'integration': 12,
            'business-logic': 10,
            'comprehensive': 18
        }
        
        const coverageMultipliers = {
            'essential': 0.6,
            'comprehensive': 1.0,
            'exhaustive': 1.4
        }
        
        const base = baseMultipliers[intent] || 12
        const coverageMultiplier = coverageMultipliers[coverage] || 1.0
        const typeMultiplier = testTypeCount * 0.3 + 0.4
        
        return Math.round(base * coverageMultiplier * typeMultiplier)
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

    async generateTestCasesWithClaude(screenshotPaths, ocrResults, pageNames, scenarioContext, forceRegenerate) {
        // Prepare images for analysis
        const imageMessages = await this.prepareImageMessages(screenshotPaths, pageNames)
        
        const prompt = this.buildUnifiedPrompt(ocrResults, pageNames, screenshotPaths.length, scenarioContext)

        console.log('Sending request to Claude for Unified AI Analysis...')
        const response = await this.makeClaudeRequestWithRetry({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 8000,
            temperature: 0.2, // Use consistent higher temperature for better quality and variation
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
        return this.parseTestCases(content)
    }

    async generateTestCasesWithOpenAI(screenshotPaths, ocrResults, pageNames, scenarioContext, forceRegenerate) {
        // Prepare images for OpenAI analysis
        const imageMessages = await this.prepareOpenAIImageMessages(screenshotPaths, pageNames)
        
        const prompt = this.buildUnifiedPrompt(ocrResults, pageNames, screenshotPaths.length, scenarioContext)

        console.log('Sending request to OpenAI for Unified AI Analysis...')
        const response = await this.makeOpenAIRequestWithRetry({
            model: 'gpt-4o',
            max_tokens: 8000,
            temperature: 0.2, // Use consistent higher temperature for better quality and variation
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

        const content = response.choices[0].message.content
        console.log('Received response from OpenAI for Unified AI Analysis')
        return this.parseTestCases(content)
    }

    async prepareOpenAIImageMessages(screenshotPaths, pageNames) {
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
                    text: `\n--- ${pageName} (Screenshot ${i + 1}) ---`
                })
                
                imageMessages.push({
                    type: 'image_url',
                    image_url: {
                        url: `data:${mimeType};base64,${base64Image}`,
                        detail: 'high'
                    }
                })
            } catch (error) {
                console.error(`Error reading screenshot ${screenshotPath}:`, error)
                imageMessages.push({
                    type: 'text',
                    text: `\n--- ${pageName} (Screenshot ${i + 1}) - IMAGE READ ERROR ---`
                })
            }
        }
        
        return imageMessages
    }

    createCacheKey(screenshotPaths, ocrResults, pageNames, aiModel = 'claude') {
        const crypto = require('crypto')
        const content = JSON.stringify({ 
            paths: screenshotPaths.map(p => path.basename(p)),
            ocr: ocrResults,
            pageNames,
            model: aiModel
        })
        return crypto.createHash('md5').update(content).digest('hex')
    }

    async makeClaudeRequestWithRetry(requestParams, maxRetries = 3) {
        let lastError
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`Claude attempt ${attempt}/${maxRetries}`)
                const response = await this.anthropic.messages.create(requestParams)
                console.log('Claude request successful')
                return response
            } catch (error) {
                lastError = error
                console.log(`Claude attempt ${attempt} failed:`, error.status, error.message)
                
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

    async makeOpenAIRequestWithRetry(requestParams, maxRetries = 3) {
        let lastError
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`OpenAI attempt ${attempt}/${maxRetries}`)
                const response = await this.openai.chat.completions.create(requestParams)
                console.log('OpenAI request successful')
                return response
            } catch (error) {
                lastError = error
                console.log(`OpenAI attempt ${attempt} failed:`, error.status || error.code, error.message)
                
                if ((error.status === 429 || error.code === 'rate_limit_exceeded') && attempt < maxRetries) {
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