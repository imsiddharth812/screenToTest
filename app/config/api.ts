// Frontend API configuration
const getApiBaseUrl = (): string => {
  // Always prefer environment variable, fallback to localhost
  return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001'
}

export const API_BASE_URL = getApiBaseUrl()

export const API_ENDPOINTS = {
  // Auth endpoints
  LOGIN: '/api/auth/login',
  SIGNUP: '/api/auth/signup',
  ME: '/api/auth/me',
  
  // Project endpoints
  PROJECTS: '/api/projects',
  
  // Feature endpoints
  FEATURES: '/api/features',
  
  // Scenario endpoints
  SCENARIOS: '/api/scenarios',
  
  // Screenshot endpoints
  SCREENSHOTS: '/api/screenshots',
  
  // Test case endpoints
  TEST_CASES: '/api/test-cases',
  GENERATE_TEST_CASES: '/api/generate-testcases',
  
  // Utility endpoints
  HEALTH: '/api/health',
  ANALYSIS_OPTIONS: '/api/analysis-options',
  
  // Download endpoints
  DOWNLOAD_XLSX: '/api/download/xlsx'
}

// Helper to build full API URL
export const buildApiUrl = (endpoint: string): string => {
  return `${API_BASE_URL}${endpoint}`
}

export default {
  API_BASE_URL,
  API_ENDPOINTS,
  buildApiUrl
}
