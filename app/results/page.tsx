"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ProtectedRoute from '../components/ProtectedRoute';

interface TestCase {
  type: string;
  title: string;
  preconditions?: string;
  testSteps: string;
  testData?: string;
  expectedResults?: string;
  description?: string; // for backward compatibility
}

interface ScreenshotInfo {
  id: string;
  customName: string;
  originalName: string;
  preview: string;
  isExisting?: boolean;
  screenshotId?: number;
}

interface TestCases {
  allTestCases?: TestCase[];
  functional?: string[];
  endToEnd?: string[];
  integration?: string[];
  performance?: string[];
  edge?: string[];
  negative?: string[];
  // Legacy format support
  target?: string[];
  system?: string[];
  positive?: string[];
  _sessionId?: string;
  // Screenshot information
  scenarioId?: number;
  scenarioName?: string;
  projectName?: string;
  featureName?: string;
  screenshots?: ScreenshotInfo[];
  // Configuration information
  aiModel?: string;
  testingIntent?: string;
  coverageLevel?: string;
  testTypes?: string[];
  userStory?: string;
  acceptanceCriteria?: string;
  businessRules?: string;
  edgeCases?: string;
  testEnvironment?: string;
  // Generation metadata
  timestamp?: string;
  generatedAt?: string;
  generationId?: string;
}

// Helper function to safely convert any value to string and split
const safeStringSplit = (value: any, delimiter: string = '\\n'): string[] => {
  const stringValue = typeof value === 'string' ? value : String(value || '')
  return stringValue.split(delimiter)
}

// Configuration Information Component
function ConfigurationInfo({ testCases }: { testCases: TestCases }) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!testCases) return null

  const hasConfiguration = testCases.aiModel || testCases.testingIntent || testCases.coverageLevel || 
    testCases.testTypes || testCases.userStory || testCases.acceptanceCriteria || 
    testCases.businessRules || testCases.edgeCases || testCases.testEnvironment

  if (!hasConfiguration) return null

  const getTestingIntentDisplay = (intent?: string) => {
    const intentMap: Record<string, { label: string; icon: string; description: string }> = {
      'comprehensive': { label: 'Comprehensive Testing', icon: '🎯', description: 'Full coverage including positive, negative, and edge cases' },
      'form-validation': { label: 'Form Validation Focus', icon: '📝', description: 'Input validation, error handling, data types, and field interactions' },
      'user-journey': { label: 'User Journey Testing', icon: '🚶', description: 'End-to-end workflows and multi-step processes' },
      'integration': { label: 'Feature Integration', icon: '🔗', description: 'Component interactions and data flow testing' },
      'business-logic': { label: 'Business Logic Validation', icon: '⚖️', description: 'Rules, calculations, and decision-making processes' }
    }
    return intentMap[intent || ''] || { label: intent || 'Unknown', icon: '❓', description: '' }
  }

  const getAiModelDisplay = (model?: string) => {
    const modelMap: Record<string, { name: string; provider: string; icon: string }> = {
      'claude': { name: 'Claude', provider: 'Anthropic', icon: '🎯' },
      'gpt-4-vision': { name: 'GPT-4 Vision', provider: 'OpenAI', icon: '🧠' },
      'gpt-4o': { name: 'GPT-4o', provider: 'OpenAI', icon: '🧠' }
    }
    return modelMap[model || ''] || { name: model || 'Unknown', provider: 'Unknown', icon: '❓' }
  }

  const getCoverageLevelDisplay = (level?: string) => {
    const levelMap: Record<string, string> = {
      'essential': 'Essential Only - Core happy path scenarios',
      'comprehensive': 'Comprehensive - Happy path + common edge cases',
      'exhaustive': 'Exhaustive - Complete coverage including rare edge cases'
    }
    return levelMap[level || ''] || level || 'Unknown'
  }

  const getTestTypesDisplay = (types?: string[]) => {
    if (!types || !Array.isArray(types)) return []
    
    const typeMap: Record<string, string> = {
      'positive': 'Positive Testing',
      'negative': 'Negative Testing', 
      'edge_cases': 'Edge Cases'
    }
    
    return types.map(type => typeMap[type] || type)
  }

  const testingIntent = getTestingIntentDisplay(testCases.testingIntent)
  const aiModel = getAiModelDisplay(testCases.aiModel)
  const coverageLevel = getCoverageLevelDisplay(testCases.coverageLevel)
  const testTypes = getTestTypesDisplay(testCases.testTypes)

  return (
    <div className="bg-white rounded-lg shadow mb-6">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 text-left border-b border-gray-200 hover:bg-gray-50 transition-colors flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">⚙️</span>
          <div>
            <h3 className="text-lg font-medium text-gray-900">Test Generation Configuration</h3>
            <p className="text-sm text-gray-500">View the settings used to generate these test cases</p>
          </div>
        </div>
        <div className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      
      {isExpanded && (
        <div className="p-6 space-y-6">
          {/* Generation Info */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
              <span>ℹ️</span>
              Generation Information
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              {testCases.generatedAt && (
                <div>
                  <span className="font-medium text-blue-800">Generated:</span>
                  <div className="text-blue-700 mt-1">
                    {new Date(testCases.generatedAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long', 
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    })}
                  </div>
                </div>
              )}
              
              {testCases.scenarioName && (
                <div>
                  <span className="font-medium text-blue-800">Scenario:</span>
                  <div className="text-blue-700 mt-1">{testCases.scenarioName}</div>
                </div>
              )}
              
              {testCases.screenshots && testCases.screenshots.length > 0 && (
                <div>
                  <span className="font-medium text-blue-800">Screenshots:</span>
                  <div className="text-blue-700 mt-1">{testCases.screenshots.length} images analyzed</div>
                </div>
              )}
            </div>
          </div>

          {/* AI Model Configuration */}
          {testCases.aiModel && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span>🤖</span>
                AI Model Configuration
              </h4>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{aiModel.icon}</span>
                  <div>
                    <div className="font-medium text-gray-900">{aiModel.name}</div>
                    <div className="text-sm text-gray-600">{aiModel.provider}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Testing Configuration */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span>🎯</span>
              Testing Configuration
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {testCases.testingIntent && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{testingIntent.icon}</span>
                    <span className="font-medium text-gray-900">Testing Focus</span>
                  </div>
                  <div className="text-sm text-gray-700">{testingIntent.label}</div>
                  {testingIntent.description && (
                    <div className="text-xs text-gray-500 mt-1">{testingIntent.description}</div>
                  )}
                </div>
              )}
              
              {testCases.coverageLevel && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="font-medium text-gray-900 mb-2">Coverage Level</div>
                  <div className="text-sm text-gray-700">{coverageLevel}</div>
                </div>
              )}
            </div>
            
            {testTypes.length > 0 && (
              <div className="bg-gray-50 p-4 rounded-lg mt-4">
                <div className="font-medium text-gray-900 mb-2">Test Types Included</div>
                <div className="flex flex-wrap gap-2">
                  {testTypes.map((type, index) => (
                    <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                      {type}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Context & Requirements */}
          {(testCases.userStory || testCases.acceptanceCriteria || testCases.businessRules || 
            testCases.edgeCases || testCases.testEnvironment) && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span>📋</span>
                Context & Requirements
              </h4>
              <div className="space-y-4">
                {testCases.userStory && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                      <span>👤</span>
                      User Story
                    </div>
                    <div className="text-sm text-gray-700 whitespace-pre-wrap">{testCases.userStory}</div>
                  </div>
                )}
                
                {testCases.acceptanceCriteria && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                      <span>✅</span>
                      Acceptance Criteria
                    </div>
                    <div className="text-sm text-gray-700 whitespace-pre-wrap">{testCases.acceptanceCriteria}</div>
                  </div>
                )}
                
                {testCases.businessRules && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                      <span>⚖️</span>
                      Business Rules
                    </div>
                    <div className="text-sm text-gray-700 whitespace-pre-wrap">{testCases.businessRules}</div>
                  </div>
                )}
                
                {testCases.edgeCases && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                      <span>🔍</span>
                      Edge Cases
                    </div>
                    <div className="text-sm text-gray-700 whitespace-pre-wrap">{testCases.edgeCases}</div>
                  </div>
                )}
                
                {testCases.testEnvironment && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                      <span>🖥️</span>
                      Test Environment
                    </div>
                    <div className="text-sm text-gray-700 whitespace-pre-wrap">{testCases.testEnvironment}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Results() {
  const [testCases, setTestCases] = useState<TestCases | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [isRegenerating, setIsRegenerating] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("testCases");
    if (stored) {
      const parsedTestCases = JSON.parse(stored);
      setTestCases(parsedTestCases);

      // If screenshots are missing or have blob URLs, try to refresh them from server
      if (parsedTestCases.scenarioId && (!parsedTestCases.screenshots || parsedTestCases.screenshots.some((s: ScreenshotInfo) => s.preview.startsWith('blob:')))) {
        refreshScreenshotsFromServer(parsedTestCases.scenarioId, parsedTestCases);
      }

      // Set initial active tab based on data format
      if (
        parsedTestCases.allTestCases &&
        parsedTestCases.allTestCases.length > 0
      ) {
        setActiveTab("all");
      } else {
        // Find first available tab for legacy format
        const availableTabs = [
          "functional",
          "endToEnd",
          "integration",
          "edge",
          "negative",
          "target",
          "system",
          "positive",
        ];
        for (const tab of availableTabs) {
          if (parsedTestCases[tab] && parsedTestCases[tab].length > 0) {
            setActiveTab(tab);
            break;
          }
        }
      }
    }
  }, []);

  // Add event listener to refresh data when window gets focus (for new tab scenarios)
  useEffect(() => {
    const handleFocus = () => {
      const stored = localStorage.getItem("testCases");
      if (stored) {
        const parsedTestCases = JSON.parse(stored);
        // Only update if we have different data
        if (JSON.stringify(parsedTestCases) !== JSON.stringify(testCases)) {
          setTestCases(parsedTestCases);
        }
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [testCases]);

  const refreshScreenshotsFromServer = async (scenarioId: number, currentTestCases: TestCases) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`http://localhost:3001/api/scenarios/${scenarioId}/screenshots`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const refreshedScreenshots: ScreenshotInfo[] = data.screenshots.map((screenshot: any) => ({
          id: screenshot.id.toString(),
          customName: screenshot.custom_name || screenshot.original_name.replace(/\.[^/.]+$/, ''),
          originalName: screenshot.original_name,
          preview: `http://localhost:3001/${screenshot.file_path}`,
          isExisting: true,
          screenshotId: screenshot.id
        }));

        const updatedTestCases = {
          ...currentTestCases,
          screenshots: refreshedScreenshots
        };

        setTestCases(updatedTestCases);
        localStorage.setItem("testCases", JSON.stringify(updatedTestCases));
      }
    } catch (error) {
      console.error('Error refreshing screenshots:', error);
    }
  };


  const downloadXlsx = async () => {
    try {
      const token = localStorage.getItem('authToken');
      console.log('Auth token exists:', !!token);
      console.log('Token length:', token?.length);
      
      if (!token) {
        alert('You are not logged in. Please refresh the page and log in again.');
        return;
      }
      
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      
      if (token) {
        headers.Authorization = `Bearer ${token}`;
        console.log('Adding Authorization header to XLSX request');
      }
      
      const response = await fetch("http://localhost:3001/api/download/xlsx", {
        method: "POST",
        headers,
        body: JSON.stringify(testCases),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "test-cases.xlsx";
        a.click();
        window.URL.revokeObjectURL(url);
        console.log('XLSX download initiated successfully');
      } else {
        const errorText = await response.text();
        console.error('XLSX download failed:', response.status, response.statusText, errorText);
        alert(`Failed to download XLSX file: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error("Download failed:", error);
      alert('An error occurred while downloading the file. Please try again.');
    }
  };

  const regenerateTestCases = async () => {
    // Handle unified approach (with scenario and screenshots) or legacy session approach
    if (!testCases?._sessionId && !(testCases?.scenarioId && testCases?.screenshots)) {
      alert("Cannot regenerate - session expired or missing screenshot information. Please upload screenshots again.");
      return;
    }

    setIsRegenerating(true);
    
    try {
      let response;
      
      if (testCases._sessionId) {
        // Legacy session-based regeneration
        response = await fetch("http://localhost:3001/api/regenerate-testcases", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sessionId: testCases._sessionId }),
        });
      } else {
        // Unified approach - regenerate using existing screenshot IDs (more reliable)
        const formData = new FormData();
        
        // Use existing screenshot IDs instead of re-uploading files
        const screenshotIds = testCases.screenshots!.map(s => s.screenshotId).filter(id => id);
        formData.append('screenshotIds', JSON.stringify(screenshotIds));
        
        // Add page names and scenario ID to preserve context
        const pageNames = testCases.screenshots!.map(s => s.customName);
        formData.append('pageNames', JSON.stringify(pageNames));
        formData.append('scenarioId', testCases.scenarioId!.toString());
        
        // Preserve AI model setting from the original generation
        console.log('=== TEST CASE REGENERATION DEBUG ===');
        console.log('Available testCases data:', Object.keys(testCases));
        console.log('Configuration being used for regeneration:');
        console.log('- AI Model:', testCases.aiModel);
        console.log('- Testing Intent:', testCases.testingIntent);
        console.log('- Coverage Level:', testCases.coverageLevel);
        console.log('- Test Types:', testCases.testTypes);
        console.log('- User Story:', testCases.userStory ? 'Present' : 'Not set');
        console.log('- Acceptance Criteria:', testCases.acceptanceCriteria ? 'Present' : 'Not set');
        console.log('- Business Rules:', testCases.businessRules ? 'Present' : 'Not set');
        console.log('- Edge Cases:', testCases.edgeCases ? 'Present' : 'Not set');
        console.log('- Test Environment:', testCases.testEnvironment ? 'Present' : 'Not set');
        console.log('- Scenario ID:', testCases.scenarioId);
        console.log('- Screenshot Count:', testCases.screenshots?.length || 0);
        
        const aiModel = testCases.aiModel || 'claude';
        formData.append('aiModel', aiModel);
        console.log('Using AI model for regeneration:', aiModel);
        console.log('=====================================');
        
        // Note: The backend will use the scenario's saved AI model if none is provided
        
        // Add authentication token for secure access
        const token = localStorage.getItem('authToken');
        const headers: HeadersInit = {};
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
        
        response = await fetch("http://localhost:3001/api/generate-testcases", {
          method: "POST",
          headers,
          body: formData,
        });
      }

      if (response.ok) {
        const result = await response.json();
        
        // Preserve important metadata
        if (testCases._sessionId) {
          result._sessionId = testCases._sessionId;
        }
        if (testCases.scenarioId) {
          result.scenarioId = testCases.scenarioId;
          result.scenarioName = testCases.scenarioName;
          result.projectName = testCases.projectName;
          result.featureName = testCases.featureName;
          result.screenshots = testCases.screenshots;
        }
        
        setTestCases(result);
        localStorage.setItem("testCases", JSON.stringify(result));
        
        // Show success message
        alert("Test cases regenerated successfully! You should see different variations now.");
      } else {
        throw new Error("Failed to regenerate test cases");
      }
    } catch (error) {
      console.error("Regeneration failed:", error);
      alert("Failed to regenerate test cases. Please try again or upload new screenshots.");
    } finally {
      setIsRegenerating(false);
    }
  };

  if (!testCases) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-600 mb-4">No test cases found</p>
          <Link
            href="/upload"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded"
          >
            Upload Screenshots
          </Link>
        </div>
      </div>
    );
  }

  // Check if we have the new format with allTestCases
  const hasNewFormat =
    testCases.allTestCases && testCases.allTestCases.length > 0;

  const tabs = hasNewFormat
    ? [
        {
          key: "all",
          label: "All Test Cases",
          count: testCases.allTestCases?.length || 0,
        },
      ]
    : [
        {
          key: "functional",
          label: "Functional",
          count: testCases.functional?.length || testCases.target?.length || 0,
        },
        {
          key: "endToEnd",
          label: "End-to-End",
          count: testCases.endToEnd?.length || testCases.system?.length || 0,
        },
        {
          key: "integration",
          label: "Integration",
          count: testCases.integration?.length || 0,
        },
        {
          key: "edge",
          label: "Edge Cases",
          count: testCases.edge?.length || 0,
        },
        {
          key: "negative",
          label: "Negative",
          count: testCases.negative?.length || 0,
        },
      ].filter((tab) => tab.count > 0);

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Generated Test Cases
          </h1>
          <div className="space-x-4">
            <Link
              href="/"
              className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded inline-flex items-center gap-2"
            >
              ← Back to Projects
            </Link>
            {(testCases._sessionId || (testCases.scenarioId && testCases.screenshots)) && (
              <button
                onClick={regenerateTestCases}
                disabled={isRegenerating}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded"
              >
                {isRegenerating ? "Regenerating..." : "🔄 Regenerate Test Cases"}
              </button>
            )}
            <button
              onClick={downloadXlsx}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded"
            >
              Download XLSX
            </button>
          </div>
        </div>

        {/* Configuration Information Display */}
        <ConfigurationInfo testCases={testCases} />


        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.key
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {hasNewFormat && activeTab === "all" ? (
              // New format with table layout
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b w-12">
                        #
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b w-24">
                        Type
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b w-64">
                        Title
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b w-48">
                        Test Data
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        Test Steps
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b w-64">
                        Expected Results
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {testCases.allTestCases?.map((testCase, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border-r">
                          {index + 1}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap border-r">
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                            {testCase.type}
                          </span>
                        </td>
                        <td className="px-3 py-4 border-r">
                          <div className="text-sm font-medium text-gray-900 leading-tight">
                            {testCase.title}
                          </div>
                        </td>
                        <td className="px-3 py-4 border-r">
                          <div className="text-xs text-gray-700 leading-relaxed">
                            {testCase.testData ? (
                              <div className="whitespace-pre-line">
                                {safeStringSplit(testCase.testData).map((line, i) => (
                                  <div key={i} className="mb-1">
                                    {line.trim().startsWith('•') ? line : `• ${line}`}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div>• Standard test data</div>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-4 border-r">
                          <div className="text-xs text-gray-700 leading-relaxed">
                            <div className="whitespace-pre-line">
                              {safeStringSplit(testCase.testSteps || testCase.description).map((line, i) => (
                                <div key={i} className="mb-1">
                                  {line.trim().match(/^\d+\./) || line.trim().startsWith('•') ? line : 
                                   line.trim() ? `• ${line}` : ''}
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-4">
                          <div className="text-xs text-gray-700 leading-relaxed">
                            {testCase.expectedResults ? (
                              <div className="whitespace-pre-line">
                                {safeStringSplit(testCase.expectedResults).map((line, i) => (
                                  <div key={i} className="mb-1">
                                    {line.trim().startsWith('•') ? line : `• ${line}`}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div>• Test should complete successfully</div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              // Legacy format or categorized view
              <div className="space-y-4">
                {(() => {
                  const currentTestCases =
                    (testCases[activeTab as keyof TestCases] as string[]) || [];
                  return currentTestCases.map((testCase, index) => (
                    <div key={index} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-start space-x-3">
                        <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </span>
                        <p className="text-gray-800">{testCase}</p>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded inline-flex items-center gap-2"
          >
            ← Back to Projects
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ProtectedResults() {
  return (
    <ProtectedRoute>
      <Results />
    </ProtectedRoute>
  );
}
