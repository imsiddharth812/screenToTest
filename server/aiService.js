const Anthropic = require('@anthropic-ai/sdk')

class AIService {
    constructor() {
        this.anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        })
        this.testCaseCache = new Map() // Cache for consistent results
    }

    async generateTestCases(ocrResults, imageCount, forceRegenerate = false, pageNames = []) {
        try {
            // Validate input
            if (!ocrResults || ocrResults.length === 0) {
                console.log('No OCR results provided, using generic context')
                ocrResults = [`${imageCount} screenshots uploaded - OCR processing failed or no text detected`]
            }

            // Create a deterministic cache key from OCR results and page names
            const cacheKey = this.createCacheKey(ocrResults, pageNames)
            
            // Check cache for consistent results (unless forced regeneration)
            if (!forceRegenerate && this.testCaseCache.has(cacheKey)) {
                console.log('Returning cached test cases for consistency')
                return this.testCaseCache.get(cacheKey)
            }

            const prompt = this.buildPrompt(ocrResults, imageCount, pageNames)

            console.log('Sending request to Claude API...')
            const response = await this.makeRequestWithRetry({
                model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
                max_tokens: 6000,
                temperature: forceRegenerate ? 0.2 : 0.05, // Slight variation for regeneration
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            })

            const content = response.content[0].text
            console.log('Received response from Claude API')
            const testCases = this.parseTestCases(content)
            
            // Cache the result for consistency
            this.testCaseCache.set(cacheKey, testCases)
            
            return testCases
        } catch (error) {
            console.error('AI Service Error:', error)
            // Re-throw the original error to preserve status codes
            throw error
        }
    }


    async generateTestCasesWithCorrections(ocrResults, imageCount, correctedElements, pageNames = [], forceRegenerate = false) {
        try {
            // Validate input
            if (!ocrResults || ocrResults.length === 0) {
                console.log('No OCR results provided, using generic context')
                ocrResults = [`${imageCount} screenshots uploaded - OCR processing failed or no text detected`]
            }

            // Create enhanced OCR results with user corrections
            const enhancedOcrResults = this.enhanceOcrWithCorrections(ocrResults, correctedElements)

            // Create a cache key that includes corrections
            const cacheKey = this.createCacheKey(enhancedOcrResults)
            
            // Check cache for consistent results (unless forced regeneration)
            if (!forceRegenerate && this.testCaseCache.has(cacheKey)) {
                console.log('Returning cached test cases with corrections')
                return this.testCaseCache.get(cacheKey)
            }

            const prompt = this.buildPromptWithCorrections(enhancedOcrResults, imageCount, correctedElements, pageNames)

            console.log('Sending request to Claude API with corrections...')
            const response = await this.anthropic.messages.create({
                model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
                max_tokens: 6000,
                temperature: forceRegenerate ? 0.2 : 0.05,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            })

            const content = response.content[0].text
            console.log('Received response from Claude API with corrections')
            const testCases = this.parseTestCases(content)
            
            // Cache the result for consistency
            this.testCaseCache.set(cacheKey, testCases)
            
            return testCases
        } catch (error) {
            console.error('AI Service Error with corrections:', error)
            throw new Error('Failed to generate test cases with corrections')
        }
    }

    enhanceOcrWithCorrections(ocrResults, correctedElements) {
        const enhanced = [...ocrResults]
        
        correctedElements.forEach(element => {
            const { screenshotIndex, detectedTexts } = element
            if (enhanced[screenshotIndex]) {
                const corrections = detectedTexts
                    .filter(item => item.label && item.label.trim())
                    .map(item => `${item.text} → [${item.type}: ${item.label}]`)
                    .join('\n')
                
                if (corrections) {
                    enhanced[screenshotIndex] += '\n\n--- USER CORRECTIONS ---\n' + corrections
                }
            }
        })
        
        return enhanced
    }

    buildPromptWithCorrections(ocrResults, imageCount, correctedElements, pageNames = []) {
        const correctionsSummary = correctedElements
            .flatMap(element => element.detectedTexts.filter(item => item.label && item.label.trim()))
            .map(item => `• "${item.text}" is identified as ${item.type}: ${item.label}`)
            .join('\n')

        return this.buildPrompt(ocrResults, imageCount, pageNames) + 
            (correctionsSummary ? `\n\n**USER-PROVIDED ELEMENT CORRECTIONS:**\n${correctionsSummary}\n\nIMPORTANT: Use these corrections to generate more accurate test cases. When referencing UI elements in test steps, use the corrected labels provided by the user instead of the raw OCR text.` : '')
    }

    createCacheKey(ocrResults, pageNames = []) {
        // Create a deterministic key based on OCR content and page names
        const crypto = require('crypto')
        const content = JSON.stringify({ ocrResults, pageNames })
        return crypto.createHash('md5').update(content).digest('hex')
    }

    buildPrompt(ocrResults, imageCount, pageNames = []) {
        const detectedText = ocrResults.map((text, index) => {
            const pageName = pageNames[index] || `Page ${index + 1}`
            return `--- ${pageName} ---\n${text}`
        }).join('\n\n')

        const pageFlow = pageNames.length > 0 
            ? pageNames.map((name, index) => `${index + 1}. ${name}`).join('\n')
            : Array.from({length: imageCount}, (_, i) => `${i + 1}. Page ${i + 1}`).join('\n')

        // Detect application domain from page names and OCR content
        const domainContext = this.detectApplicationDomain(pageNames, ocrResults)
        
        return `You are an expert QA engineer creating comprehensive test cases. Your task is to analyze the provided application screenshots and generate professional test cases that are relevant to the specific domain and user workflow.

**INTELLIGENT ANALYSIS:**
Detected Application Domain: ${domainContext.domain}
Key Business Functions: ${domainContext.functions.join(', ')}
Suggested Test Focus Areas: ${domainContext.testAreas.join(', ')}

You are an expert QA engineer creating test cases for novice testers who have NO prior knowledge of the application. Your test cases must be so detailed and clear that anyone can execute them successfully.

**Application Pages Analysis (In Sequential User Flow Order):**
${detectedText}

**USER WORKFLOW SEQUENCE:**
${pageFlow}

**IMPORTANT CONTEXT:** The pages above are provided in the EXACT SEQUENCE of the user workflow/application flow. This represents the natural progression through the application that users would follow. Use this sequence information to understand the user journey and create test cases that follow this logical progression from one page to the next.

**CRITICAL REQUIREMENTS for User-Friendly Test Cases:**

1. **Self-Contained Navigation**: Every test case must start from a known state (like homepage/login page) and guide the user step-by-step to the target screen
2. **Descriptive Titles**: Use business-friendly titles that clearly describe what is being tested
3. **Complete Context**: Never assume the user knows where they are - always specify the exact page/screen/form
4. **Detailed Instructions**: Include specific UI element descriptions (button names, field labels, menu items)
5. **Clear Expectations**: Specify exactly what the user should see at each step

**Test Case Writing Guidelines for Novice Testers:**
- **Follow the Page Flow**: Use the page sequence to create test cases that mirror the natural user journey through the application
- **Flow-Based Test Cases**: Create comprehensive tests that span multiple pages in the provided sequence (e.g., "Navigate from Login Page to Dashboard then to User Profile")
- Start each test with navigation from a common starting point (homepage, login page, dashboard)
- Use business-friendly descriptive titles like "Verify user can successfully complete the workflow from login to task completion"
- **Always use page names in steps**: "On the ${pageNames[0] || 'Login Page'}", "Navigate to the ${pageNames[1] || 'Dashboard'}", "On the ${pageNames[2] || 'User Profile Page'}"
- **Reference Page Flow**: When describing navigation, reference the flow using page names: "Following the application workflow, navigate from ${pageNames[0] || 'the first page'} to ${pageNames[2] || 'the target page'}"
- Specify exact UI elements with visual descriptions: "Click the blue 'Create New Case' button located in the top right", "Select 'High Priority' from the Priority dropdown menu"
- Describe expected visual feedback clearly: "Verify the green success message 'Client created successfully' appears at the top of the page"
- Include error scenarios with clear recovery steps
- Use consistent terminology (if you call it 'username' in one test, use 'username' everywhere, not 'user ID' or 'login')
- Explain what each field/button does when first mentioned
- Include timing expectations: "Wait up to 5 seconds for the page to load"

**Enhanced Test Case Structure:**
Each test case must include:
- "type": Category (End-to-End, Functional, Integration, Edge Case, Negative, etc.)
- "title": Business-friendly, descriptive title explaining what is being tested
- "preconditions": Clear setup requirements and starting state
- "testSteps": Detailed navigation and action steps with screen context
- "testData": Specific, realistic data values
- "expectedResults": Clear, observable outcomes

**Example of GOOD Test Case Format:**
{
  "testCases": [
    {
      "type": "Functional",
      "title": "Verify user can successfully create a new client with complete information and assign to a case",
      "preconditions": "• User is logged into the application\\n• User has permissions to create clients and cases\\n• System is accessible and functioning normally",
      "testSteps": "1. From the main dashboard, locate and click on the 'Clients' menu item\\n2. On the Clients page, click the 'Create New Client' button\\n3. On the Client Creation form, enter 'John' in the First Name field\\n4. Enter 'Smith' in the Last Name field\\n5. Enter 'john.smith@example.com' in the Email field\\n6. Enter '+1-555-123-4567' in the Phone Number field\\n7. Select 'Pacific/Auckland' from the Timezone dropdown\\n8. Click the 'Save Client' button\\n9. Verify the client appears in the clients list with status 'Active'\\n10. Navigate to the Cases section by clicking 'Cases' in the main menu\\n11. Click the 'Create New Case' button\\n12. On the Case Creation form, select the newly created client 'John Smith' from the Client dropdown\\n13. Enter 'Test Case for John Smith' in the Case Description field\\n14. Select 'High Priority' from the Priority dropdown\\n15. Set the due date to next Friday's date\\n16. Click 'Create Case' button\\n17. Verify the case appears in the cases list linked to client 'John Smith'",
      "testData": "• Client First Name: John\\n• Client Last Name: Smith\\n• Client Email: john.smith@example.com\\n• Client Phone: +1-555-123-4567\\n• Timezone: Pacific/Auckland\\n• Case Description: Test Case for John Smith\\n• Priority: High Priority\\n• Due Date: [Next Friday's date]",
      "expectedResults": "• Client 'John Smith' is created successfully and appears in clients list\\n• Client status shows as 'Active'\\n• Case is created and linked to the correct client\\n• Case appears in cases list with correct priority and due date\\n• All entered information is saved and displayed correctly\\n• No error messages are displayed during the process"
    }
  ]
}

**Coverage Areas (Generate comprehensive test cases for ALL areas):**
1. **Complete Flow Testing**: End-to-end tests that follow the exact page sequence from start to finish
2. **Happy Path Workflows**: Complete successful user journeys following the provided page flow
3. **Field Validation**: Individual form field testing with navigation context using specific page names
4. **Error Handling**: Invalid inputs with clear recovery steps at each stage of the page flow
5. **Business Logic**: Workflow rules and constraints based on the sequential page progression
6. **User Permissions**: Different user role scenarios at various points in the page flow
7. **Data Relationships**: How different entities interact across the page workflow stages
8. **Edge Cases**: Boundary conditions with full context at each step of the page sequence
9. **Integration Points**: Cross-module functionality following the natural page flow progression
10. **Flow Interruption**: Test scenarios where users deviate from or interrupt the standard page flow

**ADDITIONAL QUALITY REQUIREMENTS:**
- Include browser/system requirements when relevant
- Add timing expectations (e.g., "within 3 seconds")
- Specify exact error message text when testing negative scenarios
- Include accessibility considerations (keyboard navigation, screen readers)
- Add data cleanup steps when necessary
- Include screenshots or visual verification points
- Consider different user personas (admin, regular user, guest)
- Add performance expectations for data-heavy operations

**IMPORTANT:**
- Generate MINIMUM 12-15 comprehensive test cases for thorough coverage, Dependent on the number of pages and the complexity of the application.
- **PRIORITIZE FLOW-BASED TESTING**: Create multiple test cases that follow the page sequence to test the complete user journey
- Each test case must be completely self-contained and executable by someone with zero application knowledge
- Make titles business-friendly and descriptive (avoid technical jargon)
- **Always use page names in test steps**: Reference specific page names like "${pageNames[0] || 'Login Page'}", "${pageNames[1] || 'Dashboard'}", etc. instead of generic terms
- **NEVER reference screenshots in test steps**: Use page names and business context only
- **Always reference the page flow**: Include navigation that follows the logical sequence of named pages
- Specify exact page names and UI elements with clear visual descriptions
- Include realistic, specific test data with actual example values
- Write for someone who has never used the application before
- Consider real-world scenarios and user workflows based on the provided page sequence
- Include both positive and negative test scenarios at different points in the page flow
- Add edge cases with proper context and navigation following the page sequence
- Ensure consistent terminology throughout all test cases
- Use action-oriented language ("Click", "Enter", "Select", "Verify")
- **Create flow variations**: Test alternative paths and what happens when users skip steps or go back in the page sequence

Generate MINIMUM 12-15 extensive, user-friendly test cases that provide complete coverage with clear navigation and context. Ensure each test case is written so clearly that someone who has never seen the application before can execute it successfully without any additional guidance or context.

IMPORTANT: Your response must be a single, valid JSON object containing a 'testCases' array. Do not include any explanatory text, markdown formatting, or additional content outside of the JSON structure.

Example response format:
{
  "testCases": [
    {
      "type": "End-to-End",
      "title": "Test case title",
      "preconditions": "List of preconditions",
      "testSteps": "Detailed steps",
      "testData": "Test data to use",
      "expectedResults": "Expected outcomes"
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
                const matches = jsonStr.match(/```(?:json)?\n?([\s\S]*?)```/g)
                if (matches && matches.length > 0) {
                    // Combine all JSON blocks
                    jsonStr = matches.map(match => {
                        // Remove the markdown code block syntax
                        return match.replace(/```(?:json)?\n?/g, '').replace(/```\n?/g, '')
                    }).join(',')
                    // Wrap in an object if we have multiple blocks
                    if (matches.length > 1) {
                        jsonStr = `{"testCases": ${jsonStr}}`
                    }
                }
            }

            // Find the outermost JSON object if there's surrounding text
            const jsonStart = jsonStr.indexOf('{')
            const jsonEnd = jsonStr.lastIndexOf('}') + 1

            if (jsonStart !== -1 && jsonEnd > jsonStart) {
                jsonStr = jsonStr.substring(jsonStart, jsonEnd)
            }

            // Try to parse the JSON
            const parsed = JSON.parse(jsonStr)

            // Validate structure
            if (!parsed.testCases || !Array.isArray(parsed.testCases)) {
                throw new Error('Invalid test case structure - missing testCases array')
            }

            // Validate that each test case has the required new format
            parsed.testCases.forEach((testCase) => {
                if (!testCase.preconditions) testCase.preconditions = 'Standard system access required'
                if (!testCase.testSteps) testCase.testSteps = testCase.description || 'Test steps not specified'
                if (!testCase.testData) testCase.testData = 'Standard test data'
                if (!testCase.expectedResults) testCase.expectedResults = 'Test should complete successfully'
            })

            // Convert to the expected format for the frontend
            const result = {
                allTestCases: parsed.testCases
            }

            // Also create categorized version for backward compatibility
            const categorized = {
                functional: [],
                endToEnd: [],
                integration: [],
                edge: [],
                negative: []
            }

            parsed.testCases.forEach(testCase => {
                const type = testCase.type ? testCase.type.toLowerCase().replace(/[-\s]/g, '') : 'functional'
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
            console.error('Failed to parse AI response:', error)
            console.error('Raw content:', content)
            
            // Throw proper error instead of returning generic mock data
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
            'Healthcare/Medical': {
                keywords: ['patient', 'medical', 'appointment', 'doctor', 'prescription', 'diagnosis', 'treatment', 'health', 'clinic', 'hospital'],
                functions: ['Patient management', 'Appointment scheduling', 'Medical records', 'Prescription management'],
                testAreas: ['Patient privacy', 'Data accuracy', 'Appointment system', 'Medical compliance']
            },
            'Education/Learning': {
                keywords: ['student', 'course', 'class', 'grade', 'assignment', 'exam', 'teacher', 'education', 'learning', 'university', 'school'],
                functions: ['Student management', 'Course enrollment', 'Grade tracking', 'Assignment submission'],
                testAreas: ['Student records', 'Grade calculation', 'Course access', 'Academic integrity']
            },
            'HR/Human Resources': {
                keywords: ['employee', 'staff', 'payroll', 'leave', 'department', 'manager', 'hire', 'recruitment', 'performance', 'benefits'],
                functions: ['Employee management', 'Payroll processing', 'Leave management', 'Performance tracking'],
                testAreas: ['Employee data', 'Payroll accuracy', 'Leave approval', 'Performance reviews']
            },
            'Project Management': {
                keywords: ['project', 'task', 'milestone', 'deadline', 'team', 'resource', 'timeline', 'progress', 'deliverable', 'status'],
                functions: ['Project tracking', 'Task management', 'Team collaboration', 'Resource allocation'],
                testAreas: ['Project timeline', 'Task assignment', 'Progress tracking', 'Resource management']
            },
            'Content Management': {
                keywords: ['content', 'article', 'post', 'publish', 'edit', 'media', 'page', 'website', 'blog', 'cms', 'editor'],
                functions: ['Content creation', 'Publishing workflow', 'Media management', 'Page editing'],
                testAreas: ['Content publishing', 'Media upload', 'Editing workflow', 'Page management']
            }
        }

        // Find best matching domain
        let bestMatch = { 
            domain: 'General Business Application', 
            score: 0, 
            functions: ['Data management', 'User interaction', 'Business workflow'], 
            testAreas: ['User interface', 'Data integrity', 'Workflow completion'] 
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

    async makeRequestWithRetry(requestParams, maxRetries = 3) {
        let lastError
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`API attempt ${attempt}/${maxRetries}`)
                const response = await this.anthropic.messages.create(requestParams)
                console.log('API request successful')
                return response
            } catch (error) {
                lastError = error
                console.log(`API attempt ${attempt} failed:`, error.status, error.message)
                
                // If it's a 529 (overloaded) error, wait before retrying
                if (error.status === 529 && attempt < maxRetries) {
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000) // Exponential backoff, max 10s
                    console.log(`Waiting ${delay}ms before retry...`)
                    await new Promise(resolve => setTimeout(resolve, delay))
                    continue
                }
                
                // If it's not retryable or we've exhausted retries, throw the error
                throw error
            }
        }
        
        throw lastError
    }

}

module.exports = AIService