# Screen2TestCases

AI-powered test case generation from UI screenshots. Upload 3-5 screenshots of your application's UI and get comprehensive test cases automatically generated.

## Features

- **Upload Interface**: Drag & drop support for 3-5 screenshots
- **AI Analysis**: OCR text detection with Tesseract.js
- **Test Case Generation**: Generates 6 types of test cases:
  - Target test cases
  - Integration test cases  
  - System test cases
  - Edge cases
  - Positive test cases
  - Negative test cases
- **Export Options**: Download results as DOCX or XLSX files

## Tech Stack

- **Frontend**: Next.js 14 + Tailwind CSS
- **Backend**: Node.js + Express
- **OCR**: Tesseract.js
- **File Processing**: Multer for uploads
- **Document Generation**: docx and xlsx libraries

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd screen2testcases
```

2. Install dependencies:
```bash
npm install
```

3. Start the development servers:

**Terminal 1 - Frontend:**
```bash
npm run dev
```

**Terminal 2 - Backend:**
```bash
npm run server:dev
```

4. Open your browser and navigate to `http://localhost:3000`

## Usage

1. **Landing Page**: Click "Upload Screenshots" to get started
2. **Upload Page**: 
   - Drag and drop 3-5 screenshots or click "Browse Files"
   - Preview uploaded images
   - Click "Generate Test Cases" when ready
3. **Results Page**:
   - View generated test cases organized by category
   - Switch between different test case types using tabs
   - Download results as DOCX or XLSX files

## Project Structure

```
screen2testcases/
├── app/                    # Next.js app directory
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   ├── page.tsx          # Landing page
│   ├── upload/           # Upload page
│   └── results/          # Results page
├── server/               # Express backend
│   └── index.js         # Main server file
├── uploads/             # Temporary file storage (auto-created)
├── package.json
├── next.config.js
├── tailwind.config.js
└── README.md
```

## API Endpoints

### POST `/api/generate-testcases`
- Accepts multipart form data with image files
- Processes images with OCR
- Returns JSON with categorized test cases

### POST `/api/download/docx`
- Accepts test cases JSON in request body
- Returns DOCX file for download

### POST `/api/download/xlsx`
- Accepts test cases JSON in request body  
- Returns XLSX file for download

## Deployment

### Prerequisites

1. **Anthropic API Key**: Get your API key from [Anthropic Console](https://console.anthropic.com/)
2. **GitHub Repository**: Push your code to GitHub

### Frontend (Vercel)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Set build command: `npm run build`
4. Set output directory: `.next`
5. Deploy

### Backend (Render)

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Set the following:
   - **Build Command**: `npm install`
   - **Start Command**: `node server/index.js`
   - **Environment**: Node
4. Add environment variables:
   - `ANTHROPIC_API_KEY`: Your Claude API key
   - `PORT`: 3001 (or leave default)
5. Deploy

### Environment Variables

**Required Environment Variables:**
- `ANTHROPIC_API_KEY`: Your Claude API key from Anthropic Console

**For production, update the API URLs in the frontend:**

In `app/upload/page.tsx` and `app/results/page.tsx`, replace:
```javascript
const response = await fetch('http://localhost:3001/api/generate-testcases', {
```

With your deployed backend URL:
```javascript
const response = await fetch('https://your-backend-url.render.com/api/generate-testcases', {
```

### Production Checklist

- [ ] API key added to environment variables
- [ ] Frontend API URLs updated to production backend
- [ ] Both frontend and backend deployed successfully
- [ ] Test the complete workflow with real screenshots
- [ ] Verify DOCX and XLSX downloads work correctly

## Current Implementation

The application features **full Claude AI integration** with comprehensive test case generation. The OCR functionality with Tesseract.js extracts text from uploaded screenshots, and Claude 3.5 Sonnet analyzes the UI workflow to generate detailed, professional test cases.

### AI-Powered Features

The system generates comprehensive test cases with:
- **Unlimited test case generation** for 100% coverage
- **Context-aware analysis** of UI workflows and business processes
- **User-friendly test cases** that novice testers can execute
- **Complete navigation context** from starting points to target screens
- **Specific UI element references** and detailed instructions
- **Professional export formats** (DOCX and XLSX) with proper formatting

### Test Case Categories

- **End-to-End**: Complete business process workflows
- **Functional**: Individual feature and function testing
- **Integration**: Component interactions and data flow
- **Security**: Authentication, authorization, and data protection
- **Edge Cases**: Boundary conditions and unusual scenarios
- **Negative**: Error handling and invalid input scenarios

## Development

### Adding Real AI Integration

To integrate with Claude API:

1. Install the Anthropic SDK:
```bash
npm install @anthropic-ai/sdk
```

2. Replace the `generateMockTestCases` function in `server/index.js`:
```javascript
const Anthropic = require('@anthropic-ai/sdk')
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

async function generateTestCasesWithAI(ocrResults, imageAnalysis) {
  const prompt = `Based on these UI screenshots and OCR text: ${ocrResults.join('\n')}, generate comprehensive test cases...`
  
  const response = await anthropic.messages.create({
    model: 'claude-3-sonnet-20240229',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }]
  })
  
  // Parse and structure the response
  return structuredTestCases
}
```

3. Add environment variable for API key

### Running Tests

```bash
# Add test scripts to package.json
npm test
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details