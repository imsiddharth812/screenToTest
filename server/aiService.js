const Anthropic = require('@anthropic-ai/sdk')

class AIService {
    constructor() {
        this.anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        })
        this.testCaseCache = new Map() // Cache for consistent results
    }

    async generateTestCases(ocrResults, imageCount, forceRegenerate = false) {
        try {
            // Validate input
            if (!ocrResults || ocrResults.length === 0) {
                console.log('No OCR results provided, using generic context')
                ocrResults = [`${imageCount} screenshots uploaded - OCR processing failed or no text detected`]
            }

            // Create a deterministic cache key from OCR results
            const cacheKey = this.createCacheKey(ocrResults)
            
            // Check cache for consistent results (unless forced regeneration)
            if (!forceRegenerate && this.testCaseCache.has(cacheKey)) {
                console.log('Returning cached test cases for consistency')
                return this.testCaseCache.get(cacheKey)
            }

            const prompt = this.buildPrompt(ocrResults, imageCount)

            console.log('Sending request to Claude API...')
            const response = await this.anthropic.messages.create({
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
            throw new Error('Failed to generate test cases with AI')
        }
    }

    async generateTestCasesWithCorrections(ocrResults, imageCount, correctedElements, forceRegenerate = false) {
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

            const prompt = this.buildPromptWithCorrections(enhancedOcrResults, imageCount, correctedElements)

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

    buildPromptWithCorrections(ocrResults, imageCount, correctedElements) {
        const correctionsSummary = correctedElements
            .flatMap(element => element.detectedTexts.filter(item => item.label && item.label.trim()))
            .map(item => `• "${item.text}" is identified as ${item.type}: ${item.label}`)
            .join('\n')

        return this.buildPrompt(ocrResults, imageCount) + 
            (correctionsSummary ? `\n\n**USER-PROVIDED ELEMENT CORRECTIONS:**\n${correctionsSummary}\n\nIMPORTANT: Use these corrections to generate more accurate test cases. When referencing UI elements in test steps, use the corrected labels provided by the user instead of the raw OCR text.` : '')
    }

    createCacheKey(ocrResults) {
        // Create a deterministic key based on OCR content
        const crypto = require('crypto')
        const content = JSON.stringify({ ocrResults })
        return crypto.createHash('md5').update(content).digest('hex')
    }

    buildPrompt(ocrResults, imageCount) {
        const detectedText = ocrResults.map((text, index) =>
            `--- Screenshot ${index + 1} ---\n${text}`
        ).join('\n\n')

        return `You are an expert QA engineer creating test cases for novice testers who have NO prior knowledge of the application. Your test cases must be so detailed and clear that anyone can execute them successfully.

**Screenshots Analysis (In Sequential Order):**
${detectedText}

**IMPORTANT CONTEXT:** The screenshots above are provided in the EXACT SEQUENCE of the user workflow/application flow. Screenshot 1 represents the starting point, Screenshot 2 shows the next step in the user journey, and so on. Use this sequence information to understand the natural flow and create test cases that follow this logical progression.

**CRITICAL REQUIREMENTS for User-Friendly Test Cases:**

1. **Self-Contained Navigation**: Every test case must start from a known state (like homepage/login page) and guide the user step-by-step to the target screen
2. **Descriptive Titles**: Use business-friendly titles that clearly describe what is being tested
3. **Complete Context**: Never assume the user knows where they are - always specify the exact page/screen/form
4. **Detailed Instructions**: Include specific UI element descriptions (button names, field labels, menu items)
5. **Clear Expectations**: Specify exactly what the user should see at each step

**Test Case Writing Guidelines for Novice Testers:**
- **Follow the Sequential Flow**: Use the screenshot sequence to create test cases that mirror the natural user journey
- **Flow-Based Test Cases**: Create comprehensive tests that span multiple screenshots in the provided sequence (e.g., "Navigate from Screenshot 1 state to Screenshot 3 state")
- Start each test with navigation from a common starting point (homepage, login page, dashboard)
- Use business-friendly descriptive titles like "Verify user can successfully complete the workflow from login to task completion"
- Include screen/page names in steps: "On the Client Creation form", "Navigate to the Cases section"
- **Reference Screenshot Sequence**: When describing navigation, reference the flow: "Following the workflow shown in the screenshots, navigate from the dashboard (Screenshot 1) to the form submission (Screenshot 3)"
- Specify exact UI elements with visual descriptions: "Click the blue 'Create New Case' button located in the top right", "Select 'High Priority' from the Priority dropdown menu"
- Describe expected visual feedback clearly: "Verify the green success message 'Client created successfully' appears at the top of the page"
- Include error scenarios with clear recovery steps
- Use consistent terminology (if you call it 'username' in one test, use 'username' everywhere, not 'user ID' or 'login')
- Explain what each field/button does when first mentioned
- Include timing expectations: "Wait up to 5 seconds for the page to load"

**Enhanced Test Case Structure:**
Each test case must include:
- "type": Category (End-to-End, Functional, Integration, Security, Edge Case, Negative, etc.)
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
1. **Complete Flow Testing**: End-to-end tests that follow the exact screenshot sequence from start to finish
2. **Happy Path Workflows**: Complete successful user journeys following the provided flow
3. **Field Validation**: Individual form field testing with navigation context referencing the screenshot sequence
4. **Error Handling**: Invalid inputs with clear recovery steps at each stage of the flow
5. **Business Logic**: Workflow rules and constraints based on the sequential steps shown
6. **User Permissions**: Different user role scenarios at various points in the flow
7. **Data Relationships**: How different entities interact across the workflow stages
8. **Edge Cases**: Boundary conditions with full context at each step of the sequence
9. **Integration Points**: Cross-module functionality following the natural flow progression
10. **Flow Interruption**: Test scenarios where users deviate from or interrupt the standard flow

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
- Generate MINIMUM 12-15 comprehensive test cases for thorough coverage
- **PRIORITIZE FLOW-BASED TESTING**: Create multiple test cases that follow the screenshot sequence to test the complete user journey
- Each test case must be completely self-contained and executable by someone with zero application knowledge
- Make titles business-friendly and descriptive (avoid technical jargon)
- **Always reference the flow**: Include navigation that follows the logical sequence shown in the screenshots
- Specify exact screen/page names and UI elements with clear visual descriptions
- Include realistic, specific test data with actual example values
- Write for someone who has never used the application before
- Consider real-world scenarios and user workflows based on the provided sequence
- Include both positive and negative test scenarios at different points in the flow
- Add edge cases with proper context and navigation following the sequence
- Ensure consistent terminology throughout all test cases
- Use action-oriented language ("Click", "Enter", "Select", "Verify")
- **Create flow variations**: Test alternative paths and what happens when users skip steps or go back in the sequence

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
                security: [],
                performance: [],
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

            // Fallback to enhanced mock data
            return this.generateEnhancedMockTestCases()
        }
    }

    generateFallbackTestCases(category) {
        const fallbacks = {
            target: [
                "Verify that primary UI elements are visible and functional",
                "Verify that main action buttons respond to user clicks",
                "Verify that form fields accept appropriate input types"
            ],
            integration: [
                "Verify that data flows correctly between UI components",
                "Verify that user actions trigger appropriate system responses",
                "Verify that navigation between screens works seamlessly"
            ],
            system: [
                "Verify end-to-end user workflow completion",
                "Verify system performance under normal usage conditions",
                "Verify data persistence across user sessions"
            ],
            edge: [
                "Verify system behavior with maximum input lengths",
                "Verify handling of special characters in input fields",
                "Verify system response to rapid successive user actions"
            ],
            positive: [
                "User can successfully complete intended workflows",
                "User receives appropriate feedback for successful actions",
                "User can navigate through the application intuitively"
            ],
            negative: [
                "User cannot proceed with invalid or missing required data",
                "User receives clear error messages for invalid actions",
                "User cannot access unauthorized functionality"
            ]
        }

        return fallbacks[category] || ["Verify basic functionality works as expected"]
    }

    generateEnhancedMockTestCases() {
        // Enhanced fallback with new format
        return {
            allTestCases: [
                {
                    type: "End-to-End",
                    title: "Verify user can successfully complete client registration and case creation workflow from start to finish",
                    preconditions: "• Application is accessible via web browser\\n• User has valid login credentials with client creation permissions\\n• System is in stable operational state",
                    testSteps: "1. Open web browser and navigate to the application homepage\\n2. On the login page, enter username in the 'Username' field\\n3. Enter password in the 'Password' field and click 'Login' button\\n4. From the main dashboard, locate and click on the 'Clients' menu item in the navigation bar\\n5. On the Clients page, click the 'Create New Client' button\\n6. On the Client Registration form, fill in all required client information fields\\n7. Click the 'Save Client' button and verify success message appears\\n8. Navigate to the Cases section by clicking 'Cases' in the main menu\\n9. Click 'Create New Case' button to open the case creation form\\n10. Select the newly created client from the client dropdown list\\n11. Fill in case details including description, priority, and due date\\n12. Click 'Create Case' button and verify case is created successfully\\n13. Verify the case appears in the cases list linked to the correct client\\n14. Click 'Logout' button to end the session",
                    testData: "• Username: testuser@example.com\\n• Password: SecurePass123!\\n• Client Name: John Smith\\n• Client Email: john.smith@example.com\\n• Client Phone: +1-555-123-4567\\n• Case Description: Initial consultation case\\n• Priority: High\\n• Due Date: [Current date + 7 days]",
                    expectedResults: "• User successfully logs into the application\\n• Client is created and appears in the clients list with 'Active' status\\n• Case is created and properly linked to the client\\n• All entered information is saved and displayed correctly\\n• Success messages are displayed at each step\\n• User can logout successfully without errors"
                },
                {
                    type: "Functional",
                    title: "Verify client creation form accepts valid information and creates client successfully",
                    preconditions: "• User is logged into the application with client creation permissions\\n• User is on the main dashboard page\\n• All system components are functioning normally",
                    testSteps: "1. From the main dashboard, click on the 'Clients' menu item in the top navigation bar\\n2. On the Clients page, locate and click the 'Create New Client' button\\n3. On the Client Creation form, enter 'Sarah' in the 'First Name' field\\n4. Enter 'Johnson' in the 'Last Name' field\\n5. Enter 'sarah.johnson@email.com' in the 'Email Address' field\\n6. Enter '+1-555-987-6543' in the 'Phone Number' field\\n7. Select 'Pacific/Auckland' from the 'Timezone' dropdown menu\\n8. Click the 'Save Client' button at the bottom of the form\\n9. Verify that a success message 'Client created successfully' appears\\n10. Verify that the user is redirected to the Clients list page\\n11. Verify that 'Sarah Johnson' appears in the clients list with status 'Active'",
                    testData: "• First Name: Sarah\\n• Last Name: Johnson\\n• Email: sarah.johnson@email.com\\n• Phone: +1-555-987-6543\\n• Timezone: Pacific/Auckland",
                    expectedResults: "• Client creation form accepts all valid input data\\n• Success message 'Client created successfully' is displayed\\n• User is redirected to the Clients list page\\n• New client 'Sarah Johnson' appears in the list\\n• Client status shows as 'Active'\\n• All entered information is saved correctly"
                },
                {
                    type: "Integration",
                    title: "System integration validation",
                    preconditions: "• All system components are running\\n• Database is accessible\\n• Third-party services are available",
                    testSteps: "1. Test data flow between frontend and backend\\n2. Verify API integrations and responses\\n3. Test database operations (Create, Read, Update, Delete)\\n4. Verify third-party service integrations\\n5. Test notification and messaging systems",
                    testData: "• API endpoints: Various service calls\\n• Database records: Test data sets\\n• Integration data: Sample payloads",
                    expectedResults: "• Data flows correctly between components\\n• APIs respond appropriately\\n• Database operations complete successfully\\n• Integrations function properly"
                },
                {
                    type: "Security",
                    title: "Authentication and authorization testing",
                    preconditions: "• User accounts with different permission levels exist\\n• Security policies are configured",
                    testSteps: "1. Test login with valid and invalid credentials\\n2. Verify session management and timeout\\n3. Test access control for different user roles\\n4. Verify data protection and privacy controls\\n5. Test logout and session termination",
                    testData: "• Valid credentials: admin@test.com / AdminPass123!\\n• Invalid credentials: wrong@test.com / wrongpass\\n• User roles: Admin, User, Guest",
                    expectedResults: "• Authentication works correctly\\n• Unauthorized access is prevented\\n• User roles are properly enforced\\n• Sessions are managed securely"
                },
                {
                    type: "Edge Case",
                    title: "Boundary condition and error handling",
                    preconditions: "• Application is running in test environment\\n• Test data sets are prepared",
                    testSteps: "1. Test with maximum and minimum input values\\n2. Test with special characters and Unicode\\n3. Test network connectivity issues\\n4. Test with large data sets\\n5. Test concurrent user scenarios",
                    testData: "• Max values: 999999999\\n• Min values: 0\\n• Special chars: !@#$%^&*()\\n• Unicode: 测试数据\\n• Large dataset: 10000+ records",
                    expectedResults: "• Application handles boundary conditions gracefully\\n• Displays appropriate error messages\\n• Maintains stability under stress\\n• Recovers properly from errors"
                },
                {
                    type: "Negative",
                    title: "Verify client creation form displays appropriate error messages when required fields are left empty",
                    preconditions: "• User is logged into the application with client creation permissions\\n• User has navigated to the Client Creation form\\n• Form is displayed and ready for input",
                    testSteps: "1. From the main dashboard, click on the 'Clients' menu item in the navigation bar\\n2. On the Clients page, click the 'Create New Client' button\\n3. On the Client Creation form, leave the 'First Name' field completely empty\\n4. Leave the 'Last Name' field completely empty\\n5. Enter 'incomplete@email.com' in the 'Email Address' field\\n6. Leave the 'Phone Number' field empty\\n7. Click the 'Save Client' button without filling required fields\\n8. Verify that error messages appear for empty required fields\\n9. Verify that the form does not submit and remains on the same page\\n10. Fill in 'John' in the 'First Name' field\\n11. Fill in 'Doe' in the 'Last Name' field\\n12. Enter '+1-555-123-4567' in the 'Phone Number' field\\n13. Click 'Save Client' button again\\n14. Verify that the client is now created successfully",
                    testData: "• First Name: [Empty initially, then 'John']\\n• Last Name: [Empty initially, then 'Doe']\\n• Email: incomplete@email.com\\n• Phone: [Empty initially, then '+1-555-123-4567']\\n• Timezone: [Any valid option]",
                    expectedResults: "• Error messages appear for empty required fields (First Name, Last Name, Phone)\\n• Error messages are clear and specific (e.g., 'First Name is required')\\n• Form does not submit when required fields are empty\\n• User remains on the Client Creation form\\n• After filling required fields, client is created successfully\\n• No error messages appear when all required fields are completed"
                },
                {
                    type: "Performance",
                    title: "Verify application loads and responds within acceptable time limits during normal usage",
                    preconditions: "• Application is deployed and accessible\\n• User has valid login credentials\\n• Network connection is stable\\n• Browser is in standard configuration",
                    testSteps: "1. Open web browser and navigate to the application homepage\\n2. Record the time it takes for the homepage to fully load\\n3. Click the 'Login' button and measure response time\\n4. Enter valid credentials and click 'Sign In'\\n5. Record the time it takes to reach the main dashboard\\n6. Navigate to different sections (Clients, Cases, Reports) and measure load times\\n7. Perform a search operation and measure response time\\n8. Create a new record and measure save operation time\\n9. Generate a report and measure processing time\\n10. Logout and measure logout processing time",
                    testData: "• Homepage load target: < 3 seconds\\n• Login processing: < 2 seconds\\n• Dashboard load: < 4 seconds\\n• Section navigation: < 2 seconds\\n• Search operations: < 5 seconds\\n• Save operations: < 3 seconds\\n• Report generation: < 10 seconds",
                    expectedResults: "• Homepage loads completely within 3 seconds\\n• All user interactions respond within acceptable time limits\\n• No timeout errors occur during normal operations\\n• Application remains responsive throughout the session\\n• Performance metrics are within specified thresholds\\n• User receives visual feedback during longer operations"
                },
                {
                    type: "Accessibility",
                    title: "Verify application supports keyboard navigation and screen reader accessibility features",
                    preconditions: "• Application is loaded in a modern web browser\\n• Screen reader software is available for testing\\n• Keyboard-only navigation is enabled\\n• User understands basic accessibility testing procedures",
                    testSteps: "1. Load the application homepage using only keyboard navigation\\n2. Use Tab key to navigate through all interactive elements\\n3. Verify that focus indicators are clearly visible\\n4. Test form completion using only keyboard input\\n5. Navigate through menus using arrow keys and Enter\\n6. Test dropdown selections with keyboard\\n7. Verify that all buttons are accessible via keyboard\\n8. Test modal dialogs for keyboard accessibility\\n9. Use screen reader to verify content is properly announced\\n10. Test skip links and heading structure\\n11. Verify color contrast meets accessibility standards\\n12. Test zoom functionality up to 200% magnification",
                    testData: "• Tab order: Sequential and logical\\n• Focus indicators: Visible and high contrast\\n• Screen reader: NVDA or JAWS\\n• Zoom levels: 100%, 150%, 200%\\n• Color contrast ratio: Minimum 4.5:1",
                    expectedResults: "• All interactive elements are reachable via keyboard\\n• Tab order follows logical reading sequence\\n• Focus indicators are clearly visible\\n• Screen reader announces content appropriately\\n• No keyboard traps prevent navigation\\n• Application remains functional at 200% zoom\\n• Color contrast meets WCAG AA standards"
                },
                {
                    type: "Data Validation",
                    title: "Verify email field accepts valid email formats and rejects invalid formats with appropriate error messages",
                    preconditions: "• User is on a form containing an email input field\\n• Form is ready for data entry\\n• User has access to test with various email formats",
                    testSteps: "1. Navigate to the client registration form\\n2. Locate the email address input field\\n3. Test valid email: Enter 'user@example.com' and verify acceptance\\n4. Test valid email with subdomain: Enter 'user@mail.example.com'\\n5. Test valid email with plus sign: Enter 'user+tag@example.com'\\n6. Test invalid format: Enter 'invalid-email' (no @ symbol)\\n7. Verify appropriate error message appears\\n8. Test invalid format: Enter 'user@' (incomplete domain)\\n9. Test invalid format: Enter '@example.com' (missing username)\\n10. Test invalid format: Enter 'user@.com' (missing domain name)\\n11. Test with spaces: Enter 'user name@example.com'\\n12. Verify each invalid format shows specific error message\\n13. Test maximum length email (254 characters total)\\n14. Test form submission with valid email format",
                    testData: "• Valid emails: user@example.com, test@mail.company.org\\n• Invalid emails: plaintext, @missing.com, incomplete@\\n• Special cases: user+tag@example.com, very.long.email@domain.co.uk\\n• Maximum length: [254 character email address]",
                    expectedResults: "• Valid email formats are accepted without errors\\n• Invalid email formats trigger appropriate error messages\\n• Error messages are specific and helpful\\n• Form prevents submission with invalid email\\n• Valid email allows form to proceed\\n• Maximum length emails are handled appropriately"
                },
                {
                    type: "Browser Compatibility",
                    title: "Verify application functions correctly across different web browsers and versions",
                    preconditions: "• Multiple browsers are available for testing\\n• Application is deployed and accessible\\n• Test scenarios are documented\\n• User has admin access to test environments",
                    testSteps: "1. Test core functionality in Google Chrome (latest version)\\n2. Verify login, navigation, and data entry work properly\\n3. Test the same functionality in Mozilla Firefox\\n4. Verify all features work identically in Firefox\\n5. Test in Microsoft Edge browser\\n6. Test in Safari (if Mac is available)\\n7. Verify responsive design works in all browsers\\n8. Test JavaScript functionality across browsers\\n9. Verify CSS styling displays consistently\\n10. Test file upload functionality in each browser\\n11. Test download functionality in each browser\\n12. Check console for browser-specific errors\\n13. Verify printing functionality works in all browsers",
                    testData: "• Chrome: Latest stable version\\n• Firefox: Latest stable version\\n• Edge: Latest stable version\\n• Safari: Latest available version\\n• Test data: Standard user account and sample files",
                    expectedResults: "• Application loads successfully in all tested browsers\\n• All functionality works consistently across browsers\\n• Visual appearance is consistent (within acceptable variation)\\n• No browser-specific JavaScript errors occur\\n• Performance is acceptable in all browsers\\n• File uploads and downloads work in all browsers"
                },
                {
                    type: "Mobile Responsiveness",
                    title: "Verify application displays and functions correctly on mobile devices and tablets",
                    preconditions: "• Mobile devices or browser developer tools are available\\n• Application is accessible from mobile browsers\\n• Various screen sizes can be tested\\n• Touch functionality is available for testing",
                    testSteps: "1. Open application on mobile device or set browser to mobile view\\n2. Verify homepage displays properly on mobile screen\\n3. Test navigation menu functionality on mobile\\n4. Verify touch interactions work for buttons and links\\n5. Test form input on mobile keyboard\\n6. Verify text is readable without horizontal scrolling\\n7. Test orientation changes (portrait/landscape)\\n8. Verify images scale appropriately\\n9. Test scrolling behavior on long pages\\n10. Verify modal dialogs work on mobile\\n11. Test tablet view (medium screen size)\\n12. Verify touch gestures work appropriately\\n13. Test download functionality on mobile",
                    testData: "• Mobile devices: iPhone, Android phones\\n• Tablet devices: iPad, Android tablets\\n• Screen sizes: 320px, 768px, 1024px width\\n• Orientations: Portrait and landscape",
                    expectedResults: "• Application displays properly on all tested screen sizes\\n• Navigation is accessible and functional on mobile\\n• Text is readable without zooming\\n• Touch interactions work smoothly\\n• Forms are usable with mobile keyboards\\n• No horizontal scrolling is required\\n• App functions identically across orientations"
                },
                {
                    type: "Search Functionality",
                    title: "Verify search feature returns accurate results and handles various search scenarios",
                    preconditions: "• User is logged into the application\\n• Search functionality is visible and accessible\\n• Database contains sample data for testing\\n• User has permission to access search features",
                    testSteps: "1. Navigate to the main search interface\\n2. Enter a simple search term that should return results\\n3. Verify results are displayed in a clear, organized manner\\n4. Test search with partial terms (e.g., 'john' should find 'Johnson')\\n5. Test case-insensitive search (uppercase and lowercase)\\n6. Test search with special characters and numbers\\n7. Test empty search (no search term entered)\\n8. Test search with no results (non-existent term)\\n9. Test very long search terms\\n10. Test search with multiple words\\n11. Verify search filters work if available\\n12. Test search result pagination if applicable\\n13. Verify clicking on search results navigates correctly",
                    testData: "• Valid search terms: john, client, case, email\\n• Partial terms: joh, cli, cas\\n• Special cases: @, #, numbers, symbols\\n• Long terms: verylongsearchtermthatexceedsexpectations\\n• Multi-word: john smith, new client",
                    expectedResults: "• Relevant results are returned for valid search terms\\n• Partial matches work appropriately\\n• Search is case-insensitive\\n• Empty searches show appropriate message\\n• No results scenario is handled gracefully\\n• Search results are clickable and navigate correctly\\n• Search performance is acceptable (under 5 seconds)"
                },
                {
                    type: "File Upload",
                    title: "Verify file upload functionality accepts valid file types and handles invalid files appropriately",
                    preconditions: "• User has access to file upload functionality\\n• Various test files are available (valid and invalid)\\n• User has appropriate permissions for file operations\\n• File size limits are known and documented",
                    testSteps: "1. Navigate to file upload interface\\n2. Test uploading a valid file type (e.g., PDF, JPG)\\n3. Verify file uploads successfully and confirmation appears\\n4. Test uploading multiple files if supported\\n5. Test uploading a file that exceeds size limit\\n6. Verify appropriate error message for oversized files\\n7. Test uploading an invalid file type (e.g., .exe if not allowed)\\n8. Verify rejection message for invalid file types\\n9. Test uploading a file with special characters in filename\\n10. Test uploading a file with very long filename\\n11. Test uploading an empty file (0 bytes)\\n12. Verify uploaded files can be downloaded\\n13. Test file deletion functionality if available",
                    testData: "• Valid files: document.pdf, image.jpg, spreadsheet.xlsx\\n• Invalid files: virus.exe, script.bat\\n• Large files: > maximum size limit\\n• Special names: file with spaces.pdf, file@#$.jpg\\n• Empty file: 0-byte file",
                    expectedResults: "• Valid files upload successfully with confirmation\\n• Invalid file types are rejected with clear error messages\\n• Oversized files are rejected with size limit information\\n• Upload progress is shown for large files\\n• Uploaded files are accessible and downloadable\\n• File management features work as expected"
                },
                {
                    type: "Session Management",
                    title: "Verify user session management including timeout and concurrent session handling",
                    preconditions: "• User has valid login credentials\\n• Session timeout settings are configured\\n• Multiple browser instances can be opened\\n• User understands expected session behavior",
                    testSteps: "1. Log into the application and note the session start time\\n2. Perform normal operations to establish active session\\n3. Leave the application idle for the specified timeout period\\n4. Return and attempt to perform an action requiring authentication\\n5. Verify appropriate timeout behavior occurs\\n6. Test login from multiple browser tabs/windows\\n7. Verify concurrent sessions are handled appropriately\\n8. Test 'Remember Me' functionality if available\\n9. Test explicit logout functionality\\n10. Verify session is properly terminated after logout\\n11. Test browser refresh behavior during active session\\n12. Test session behavior when browser is closed and reopened",
                    testData: "• Session timeout: 30 minutes (or configured value)\\n• Multiple browsers: Chrome, Firefox, Edge\\n• Test accounts: Standard user credentials\\n• Actions: Create, edit, delete operations",
                    expectedResults: "• Active sessions remain valid during normal use\\n• Idle sessions timeout appropriately\\n• Users are redirected to login after timeout\\n• Concurrent sessions work as designed\\n• Logout terminates session completely\\n• Session data is not accessible after logout\\n• Browser refresh maintains session appropriately"
                },
                {
                    type: "Data Export",
                    title: "Verify data can be exported to various formats and files contain accurate information",
                    preconditions: "• User is logged into the application\\n• Sample data exists for export testing\\n• User has permissions to export data\\n• Various export formats are available",
                    testSteps: "1. Navigate to the data export functionality\\n2. Select data to export (e.g., client list, case reports)\\n3. Choose DOCX export format and initiate export\\n4. Verify file downloads successfully\\n5. Open downloaded DOCX file and verify content accuracy\\n6. Repeat export process for XLSX format\\n7. Verify XLSX file opens correctly in spreadsheet application\\n8. Check that all data fields are present and accurate\\n9. Test export with different data sets\\n10. Test export with filtered data if filtering is available\\n11. Verify export file naming convention\\n12. Test large data set export performance\\n13. Verify exported data matches displayed data exactly",
                    testData: "• Export formats: DOCX, XLSX\\n• Data sets: Client list, case reports, user activity\\n• File sizes: Small (< 1MB), Medium (1-10MB), Large (> 10MB)\\n• Special characters: Unicode, symbols, numbers",
                    expectedResults: "• Export functionality works for all supported formats\\n• Downloaded files open correctly in appropriate applications\\n• Exported data is complete and accurate\\n• File naming follows expected convention\\n• Large exports complete within reasonable time\\n• Exported files maintain data formatting\\n• No data corruption occurs during export process"
                }
            ],
            functional: [
                "Verify that the main user workflow completes successfully from start to finish",
                "Verify that all primary navigation elements are functional and accessible",
                "Verify that form submissions process correctly with valid data"
            ],
            endToEnd: [
                "Complete end-to-end user journey from login to task completion",
                "Verify entire business process workflow functions correctly",
                "Test full user scenario including all major touchpoints"
            ],
            integration: [
                "Verify that frontend and backend data synchronization works correctly",
                "Verify that third-party API integrations function properly",
                "Verify that database operations work seamlessly with the UI"
            ],
            security: [
                "Verify user authentication and authorization work as expected",
                "Verify that security measures protect against common vulnerabilities",
                "Verify proper access control and data protection"
            ],
            edge: [
                "Verify application behavior when network connectivity is intermittent",
                "Verify system response when maximum input limits are reached",
                "Verify handling of special characters and Unicode in all input fields"
            ],
            negative: [
                "User cannot access restricted areas without proper authentication",
                "User cannot submit forms with missing required fields",
                "User receives appropriate error messages for invalid input formats"
            ]
        }
    }
}

module.exports = AIService