"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface TestCase {
  type: string;
  title: string;
  preconditions?: string;
  testSteps: string;
  testData?: string;
  expectedResults?: string;
  description?: string; // for backward compatibility
}

interface TestCases {
  allTestCases?: TestCase[];
  functional?: string[];
  endToEnd?: string[];
  integration?: string[];
  security?: string[];
  performance?: string[];
  edge?: string[];
  negative?: string[];
  // Legacy format support
  target?: string[];
  system?: string[];
  positive?: string[];
  _sessionId?: string;
}

export default function Results() {
  const [testCases, setTestCases] = useState<TestCases | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [isRegenerating, setIsRegenerating] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("testCases");
    if (stored) {
      const parsedTestCases = JSON.parse(stored);
      setTestCases(parsedTestCases);

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
          "security",
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

  const downloadDocx = async () => {
    try {
      const response = await fetch("http://localhost:3001/api/download/docx", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(testCases),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "test-cases.docx";
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  const downloadXlsx = async () => {
    try {
      const response = await fetch("http://localhost:3001/api/download/xlsx", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
      }
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  const regenerateTestCases = async () => {
    if (!testCases?._sessionId) {
      alert("Cannot regenerate - session expired. Please upload screenshots again.");
      return;
    }

    setIsRegenerating(true);
    
    try {
      const response = await fetch("http://localhost:3001/api/regenerate-testcases", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionId: testCases._sessionId }),
      });

      if (response.ok) {
        const result = await response.json();
        result._sessionId = testCases._sessionId; // Preserve session ID
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
          key: "security",
          label: "Security",
          count: testCases.security?.length || 0,
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
            {testCases._sessionId && (
              <button
                onClick={regenerateTestCases}
                disabled={isRegenerating}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded"
              >
                {isRegenerating ? "Regenerating..." : "🔄 Regenerate Test Cases"}
              </button>
            )}
            <button
              onClick={downloadDocx}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded"
            >
              Download DOCX
            </button>
            <button
              onClick={downloadXlsx}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded"
            >
              Download XLSX
            </button>
          </div>
        </div>

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
                                {testCase.testData.split('\\n').map((line, i) => (
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
                              {(testCase.testSteps || testCase.description || '').split('\\n').map((line, i) => (
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
                                {testCase.expectedResults.split('\\n').map((line, i) => (
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
            href="/upload"
            className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded"
          >
            Upload New Screenshots
          </Link>
        </div>
      </div>
    </div>
  );
}
