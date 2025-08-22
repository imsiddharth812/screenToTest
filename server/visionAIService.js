const Anthropic = require('@anthropic-ai/sdk')
const fs = require('fs')
const path = require('path')

class VisionAIService {
    constructor() {
        this.anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        })
        this.testCaseCache = new Map()
    }

    async generateTestCasesWithVision(screenshotPaths, pageNames = [], forceRegenerate = false) {
        try {
            // Create cache key
            const cacheKey = this.createCacheKey(screenshotPaths, pageNames)
            
            // Check cache for consistent results (unless forced regeneration)
            if (!forceRegenerate && this.testCaseCache.has(cacheKey)) {
                console.log('Returning cached vision AI test cases')
                return this.testCaseCache.get(cacheKey)
            }

            // Prepare images for vision analysis
            const imageMessages = await this.prepareImageMessages(screenshotPaths, pageNames)
            
            const prompt = this.buildVisionPrompt(pageNames, screenshotPaths.length)

            console.log('Sending request to Claude Vision API...')
            const response = await this.makeRequestWithRetry({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 6000,
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
            console.log('Received response from Claude Vision API')
            const testCases = this.parseTestCases(content)
            
            // Cache the result
            this.testCaseCache.set(cacheKey, testCases)
            
            return testCases
        } catch (error) {
            console.error('Vision AI Service Error:', error)
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

    buildVisionPrompt(pageNames, imageCount) {
        const pageFlow = pageNames.length > 0 
            ? pageNames.map((name, index) => `${index + 1}. ${name}`).join('\\n')
            : Array.from({length: imageCount}, (_, i) => `${i + 1}. Page ${i + 1}`).join('\\n')

        return `You are an expert QA engineer with advanced visual analysis capabilities. You can see and analyze the provided application screenshots to generate comprehensive test cases that cover both functional and visual aspects of the application.

**VISION-ENHANCED ANALYSIS:**
You have access to the actual screenshots of the application. Use your visual analysis to understand:
- UI layout and component positioning
- Visual hierarchy and user flow
- Form fields, buttons, and interactive elements
- Navigation structure and menu systems
- Visual design patterns and consistency
- Data presentation and formatting
- Error states and visual feedback
- Responsive design elements

**USER WORKFLOW SEQUENCE:**
${pageFlow}

**IMPORTANT CONTEXT:** The screenshots above are provided in the EXACT SEQUENCE of the user workflow/application flow. This represents the natural progression through the application that users would follow.

**PRIMARY TEST TYPES TO GENERATE (Vision-Enhanced):**
1. **End-to-End Tests**: Complete user workflows from start to finish, validated by visual confirmation
2. **Integration Tests**: Cross-module functionality with visual verification of data flow
3. **Functional Tests**: Feature testing with UI interaction validation
4. **UI Tests**: Visual element testing, layout validation, responsive behavior

**VISION-SPECIFIC TEST AREAS:**
1. **Visual Layout Testing**: Element positioning, alignment, spacing consistency
2. **Interactive Element Testing**: Button states, hover effects, form field behavior
3. **Navigation Flow Testing**: Menu functionality, breadcrumb accuracy, page transitions
4. **Visual Feedback Testing**: Success/error messages, loading states, progress indicators
5. **Form Validation Testing**: Visual validation cues, error highlighting, required field indicators
6. **Responsive Design Testing**: Layout adaptation, element visibility across different states
7. **Visual Consistency Testing**: Design pattern adherence, color scheme consistency
8. **Data Display Testing**: Table formatting, list presentation, card layouts

**ENHANCED TEST CASE REQUIREMENTS:**
- Use actual visual observations from the screenshots
- Reference specific UI elements you can see in the images
- Include visual validation steps (e.g., "Verify the green success banner appears")
- Test visual states and transitions
- Validate visual hierarchy and user experience flow
- Include visual accessibility considerations (contrast, text size, button size)

**CRITICAL REQUIREMENTS for Vision-Enhanced Test Cases:**
1. **Visual Validation**: Every test case must include visual confirmation steps
2. **UI Element Specificity**: Reference actual buttons, fields, and elements visible in screenshots
3. **Layout Verification**: Include steps to verify proper layout and positioning
4. **Visual Feedback Confirmation**: Validate visual cues, messages, and state changes
5. **Cross-Page Visual Consistency**: Ensure consistent design patterns across workflow

**Test Case Writing Guidelines (Vision-Enhanced):**
- Reference actual UI elements you observe in the screenshots
- Include visual validation at each step ("Verify the blue 'Save' button is enabled")
- Test visual states (hover, focus, disabled, error states)
- Validate visual feedback and error messages
- Check visual consistency across pages
- Include visual accessibility validations
- Use specific color, size, and position descriptions from what you see
- Test visual transitions and animations if apparent

**Enhanced Test Case Structure:**
Each test case must include:
- "type": Category (End-to-End, Integration, Functional, or UI)
- "title": Business-friendly, descriptive title explaining what is being tested
- "preconditions": Clear setup requirements and starting state
- "testSteps": Detailed navigation and action steps with visual confirmations (formatted as numbered list: "1. Step one\\n2. Step two\\n3. Step three")
- "testData": Specific, realistic data values (formatted as bullet points: "• Data item 1\\n• Data item 2\\n• Data item 3")
- "expectedResults": Clear, observable visual and functional outcomes (formatted as bullet points: "• Expected result 1\\n• Expected result 2\\n• Expected result 3")

**IMPORTANT INSTRUCTIONS:**
- Generate MINIMUM 12-15 comprehensive test cases for thorough coverage
- Each test case must be completely self-contained and executable by someone with zero application knowledge
- Always use page names in test steps: "${pageNames[0] || 'Page 1'}", "${pageNames[1] || 'Page 2'}", etc.
- Include specific visual validations based on what you see in the screenshots
- Reference actual UI elements, colors, positions, and layouts from the images
- Validate both functional behavior AND visual presentation
- Include error scenarios with visual error state validation
- Test visual consistency and user experience flow

IMPORTANT: Your response must be a single, valid JSON object containing a 'testCases' array. Do not include any explanatory text, markdown formatting, or additional content outside of the JSON structure.

Example response format:
{
  "testCases": [
    {
      "type": "UI",
      "title": "Visual validation test case title",
      "preconditions": "Clear setup requirements and starting state",
      "testSteps": "1. Navigate to page\\n2. Click on element\\n3. Verify result",
      "testData": "• Username: testuser@example.com\\n• Password: TestPass123\\n• Company: Test Corp",
      "expectedResults": "• Element should be visible\\n• Form should submit successfully\\n• Success message should appear"
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
                // Convert objects to proper string format for Test Data
                if (typeof testCase.testData === 'object' && testCase.testData !== null) {
                    if (Array.isArray(testCase.testData)) {
                        testCase.testData = testCase.testData.join('\n')
                    } else {
                        // Convert object to key-value pairs
                        testCase.testData = Object.entries(testCase.testData)
                            .map(([key, value]) => `${key}: ${value}`)
                            .join('\n')
                    }
                }
                
                // Ensure all fields are strings to prevent TypeError in frontend
                testCase.preconditions = String(testCase.preconditions || 'Standard system access required')
                testCase.testSteps = String(testCase.testSteps || testCase.description || 'Test steps not specified')
                testCase.testData = String(testCase.testData || 'Standard test data')
                testCase.expectedResults = String(testCase.expectedResults || 'Test should complete successfully')
                testCase.title = String(testCase.title || 'Untitled Test Case')
                testCase.type = String(testCase.type || 'Functional')
                
                // Format test steps and expected results to match OCR format (numbered/bullet points)
                testCase.testSteps = this.formatToNumberedList(testCase.testSteps)
                testCase.expectedResults = this.formatToBulletList(testCase.expectedResults)
                testCase.testData = this.formatToBulletList(testCase.testData)
                
                // Remove any undefined or null values that could cause issues
                Object.keys(testCase).forEach(key => {
                    if (testCase[key] === undefined || testCase[key] === null) {
                        testCase[key] = ''
                    }
                })
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
            console.error('Failed to parse Vision AI response:', error)
            console.error('Raw content:', content)
            throw new Error('Failed to generate test cases: Vision AI response could not be parsed. Please try again.')
        }
    }

    createCacheKey(screenshotPaths, pageNames) {
        const crypto = require('crypto')
        const content = JSON.stringify({ 
            paths: screenshotPaths.map(p => path.basename(p)), // Only use filenames for cache
            pageNames 
        })
        return crypto.createHash('md5').update(content).digest('hex')
    }

    async makeRequestWithRetry(requestParams, maxRetries = 3) {
        let lastError
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`Vision API attempt ${attempt}/${maxRetries}`)
                const response = await this.anthropic.messages.create(requestParams)
                console.log('Vision API request successful')
                return response
            } catch (error) {
                lastError = error
                console.log(`Vision API attempt ${attempt} failed:`, error.status, error.message)
                
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
        
        // Split by common delimiters and clean up
        const lines = text.split(/[,;]|\d+\.\s*|\n/)
            .map(line => line.trim())
            .filter(line => line.length > 0)
        
        // If already numbered, return as is
        if (text.match(/^\d+\.\s/)) return text
        
        // Convert to numbered list
        return lines.map((line, index) => `${index + 1}. ${line}`).join('\n')
    }

    formatToBulletList(text) {
        if (!text || typeof text !== 'string') return text
        
        // Split by common delimiters and clean up
        const lines = text.split(/[,;]|\n/)
            .map(line => line.trim())
            .filter(line => line.length > 0)
        
        // If already has bullets, return as is
        if (text.includes('•') || text.includes('-') || text.includes('*')) return text
        
        // Convert to bullet list
        return lines.map(line => `• ${line}`).join('\n')
    }
}

module.exports = VisionAIService