const Anthropic = require('@anthropic-ai/sdk')

class AIService {
    constructor() {
        this.anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        })
    }

    async generateTestCases(ocrResults, imageCount) {
        try {
            // Validate input
            if (!ocrResults || ocrResults.length === 0) {
                console.log('No OCR results provided, using generic context')
                ocrResults = [`${imageCount} screenshots uploaded - OCR processing failed or no text detected`]
            }

            const prompt = this.buildPrompt(ocrResults, imageCount)

            console.log('Sending request to Claude API...')
            const response = await this.anthropic.messages.create({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 4000,
                temperature: 0.3,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            })

            const content = response.content[0].text
            console.log('Received response from Claude API')
            return this.parseTestCases(content)
        } catch (error) {
            console.error('AI Service Error:', error)
            throw new Error('Failed to generate test cases with AI')
        }
    }

    buildPrompt(ocrResults, imageCount) {
        const detectedText = ocrResults.map((text, index) =>
            `--- Screenshot ${index + 1} ---\n${text}`
        ).join('\n\n')

        return `You are an expert QA engineer creating test cases for novice testers who have NO prior knowledge of the application. Your test cases must be so detailed and clear that anyone can execute them successfully.

**Screenshots Analysis:**
${detectedText}

**CRITICAL REQUIREMENTS for User-Friendly Test Cases:**

1. **Self-Contained Navigation**: Every test case must start from a known state (like homepage/login page) and guide the user step-by-step to the target screen
2. **Descriptive Titles**: Use business-friendly titles that clearly describe what is being tested
3. **Complete Context**: Never assume the user knows where they are - always specify the exact page/screen/form
4. **Detailed Instructions**: Include specific UI element descriptions (button names, field labels, menu items)
5. **Clear Expectations**: Specify exactly what the user should see at each step

**Test Case Writing Guidelines:**
- Start each test with navigation from a common starting point (homepage, login page, dashboard)
- Use descriptive titles like "Verify user can successfully create a new client with all required information"
- Include screen/page names in steps: "On the Client Creation form", "Navigate to the Cases section"
- Specify exact UI elements: "Click the 'Create New Case' button", "Select 'High Priority' from the Priority dropdown"
- Describe expected visual feedback: "Verify the success message 'Client created successfully' appears"
- Include error scenarios with clear recovery steps

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
1. **Happy Path Workflows**: Complete successful user journeys
2. **Field Validation**: Individual form field testing with navigation context
3. **Error Handling**: Invalid inputs with clear recovery steps
4. **Business Logic**: Workflow rules and constraints
5. **User Permissions**: Different user role scenarios
6. **Data Relationships**: How different entities interact
7. **Edge Cases**: Boundary conditions with full context
8. **Integration Points**: Cross-module functionality

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
- Generate as many test cases as needed for 100% coverage (NO LIMITS)
- Make titles business-friendly and descriptive
- Always include complete navigation from a starting point
- Specify exact screen/page names and UI elements
- Include realistic, specific test data
- Write for someone who has never used the application before
- Consider real-world scenarios and user workflows
- Include both positive and negative test scenarios
- Add edge cases with proper context and navigation

Generate extensive, user-friendly test cases that provide complete coverage with clear navigation and context.`
    }



    parseTestCases(content) {
        try {
            // Clean the content to extract JSON
            let jsonStr = content.trim()

            // Remove any markdown code blocks
            jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '')

            // Find the JSON object
            const jsonStart = jsonStr.indexOf('{')
            const jsonEnd = jsonStr.lastIndexOf('}') + 1

            if (jsonStart !== -1 && jsonEnd > jsonStart) {
                jsonStr = jsonStr.substring(jsonStart, jsonEnd)
            }

            const parsed = JSON.parse(jsonStr)

            // Validate structure
            if (!parsed.testCases || !Array.isArray(parsed.testCases)) {
                throw new Error('Invalid test case structure - missing testCases array')
            }

            // Validate that each test case has the required new format
            parsed.testCases.forEach((testCase, index) => {
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