"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface DetectedText {
  id: string;
  text: string;
  label: string;
  type: string;
  category?: string;
  priority?: number;
  grouped?: boolean;
  examples?: string[];
}

interface DetectedElement {
  screenshotIndex: number;
  pageName?: string;
  detectedTexts: DetectedText[];
}

interface ReviewData {
  sessionId: string;
  detectedElements: DetectedElement[];
  requiresReview: boolean;
}

const UI_TYPES = [
  { value: 'button', label: 'Button', icon: '🔘', category: 'interactive' },
  { value: 'link', label: 'Link', icon: '🔗', category: 'interactive' },
  { value: 'navigation', label: 'Navigation', icon: '🧭', category: 'navigation' },
  { value: 'form_field', label: 'Form Field', icon: '📝', category: 'form' },
  { value: 'input', label: 'Input Field', icon: '📝', category: 'form' },
  { value: 'dropdown', label: 'Dropdown', icon: '⬇️', category: 'form' },
  { value: 'checkbox', label: 'Checkbox', icon: '☑️', category: 'form' },
  { value: 'table_header', label: 'Table Header', icon: '📊', category: 'structure' },
  { value: 'table_data', label: 'Table Data', icon: '🗂️', category: 'data' },
  { value: 'text', label: 'Text/Label', icon: '📄', category: 'content' },
  { value: 'header', label: 'Header/Title', icon: '📌', category: 'content' },
  { value: 'error', label: 'Error Message', icon: '⚠️', category: 'feedback' },
  { value: 'success', label: 'Success Message', icon: '✅', category: 'feedback' },
  { value: 'other', label: 'Other', icon: '❓', category: 'unknown' }
];

const CATEGORIES = {
  interactive: { label: 'Interactive Elements', icon: '🎯', color: 'blue', priority: 1 },
  navigation: { label: 'Navigation', icon: '🧭', color: 'purple', priority: 1 },
  form: { label: 'Form Controls', icon: '📝', color: 'green', priority: 2 },
  structure: { label: 'Page Structure', icon: '📊', color: 'orange', priority: 2 },
  content: { label: 'Content & Labels', icon: '📄', color: 'gray', priority: 3 },
  data: { label: 'Table Data', icon: '🗂️', color: 'yellow', priority: 4 },
  feedback: { label: 'Messages', icon: '💬', color: 'red', priority: 3 },
  unknown: { label: 'Other', icon: '❓', color: 'gray', priority: 3 }
};

export default function Review() {
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [detectedElements, setDetectedElements] = useState<DetectedElement[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showDataElements, setShowDataElements] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set(['data']));
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem("detectionReview");
    if (stored) {
      const data = JSON.parse(stored);
      setReviewData(data);
      setDetectedElements(data.detectedElements);
    }
  }, []);

  const updateElementLabel = (elementIndex: number, textIndex: number, field: 'label' | 'type', value: string) => {
    setDetectedElements(prev => {
      const updated = [...prev];
      updated[elementIndex].detectedTexts[textIndex][field] = value;
      return updated;
    });
  };

  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const groupElementsByCategory = (elements: DetectedElement[]) => {
    const grouped: { [key: string]: { element: DetectedElement, texts: DetectedText[] }[] } = {};
    
    elements.forEach(element => {
      element.detectedTexts.forEach(text => {
        const category = text.category || 'unknown';
        if (!grouped[category]) {
          grouped[category] = [];
        }
        
        // Find existing element group or create new one
        let elementGroup = grouped[category].find(g => g.element.screenshotIndex === element.screenshotIndex);
        if (!elementGroup) {
          elementGroup = { element, texts: [] };
          grouped[category].push(elementGroup);
        }
        elementGroup.texts.push(text);
      });
    });
    
    return grouped;
  };

  const getElementCounts = () => {
    const grouped = groupElementsByCategory(detectedElements);
    const counts: { [key: string]: { total: number, labeled: number } } = {};
    
    Object.entries(grouped).forEach(([category, elementGroups]) => {
      const allTexts = elementGroups.flatMap(g => g.texts);
      counts[category] = {
        total: allTexts.length,
        labeled: allTexts.filter(t => t.label.trim()).length
      };
    });
    
    return counts;
  };

  const generateTestCases = async () => {
    if (!reviewData?.sessionId) {
      alert("Session expired. Please upload screenshots again.");
      return;
    }

    setIsGenerating(true);
    
    try {
      const response = await fetch("http://localhost:3001/api/generate-with-corrections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: reviewData.sessionId,
          correctedElements: detectedElements
        }),
      });

      if (response.ok) {
        const result = await response.json();
        localStorage.setItem("testCases", JSON.stringify(result));
        router.push("/results");
      } else {
        throw new Error("Failed to generate test cases");
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Failed to generate test cases. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const skipReview = async () => {
    // Generate test cases without corrections
    generateTestCases();
  };

  const getCompletionStats = () => {
    const totalTexts = detectedElements.reduce((sum, element) => sum + element.detectedTexts.length, 0);
    const labeledTexts = detectedElements.reduce((sum, element) => 
      sum + element.detectedTexts.filter(text => text.label.trim()).length, 0
    );
    return { total: totalTexts, labeled: labeledTexts };
  };

  if (!reviewData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-600 mb-4">No detection data found</p>
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

  const stats = getCompletionStats();
  const grouped = groupElementsByCategory(detectedElements);
  const categoryCounts = getElementCounts();

  return (
    <div className="min-h-screen py-8 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            🧠 Smart Element Detection Review
          </h1>
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 mb-6">
            <p className="text-blue-800 mb-3">
              <strong>🎯 Intelligent Filtering Applied:</strong> We've automatically categorized your UI elements and grouped repetitive data to focus on what's important for test case generation!
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="bg-white rounded-lg p-3">
                <div className="font-medium text-blue-900">📊 Total Elements</div>
                <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
                <div className="text-blue-700">detected across all pages</div>
              </div>
              <div className="bg-white rounded-lg p-3">
                <div className="font-medium text-green-900">✅ Labeled</div>
                <div className="text-2xl font-bold text-green-600">{stats.labeled}</div>
                <div className="text-green-700">({Math.round((stats.labeled / stats.total) * 100)}% complete)</div>
              </div>
              <div className="bg-white rounded-lg p-3">
                <div className="font-medium text-purple-900">🎯 Categories</div>
                <div className="text-2xl font-bold text-purple-600">{Object.keys(grouped).length}</div>
                <div className="text-purple-700">smart groups created</div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              💡 <strong>Smart Tip:</strong> Interactive elements and forms are prioritized. Data tables are grouped to reduce noise.
            </div>
            <div className="space-x-4">
              <button
                onClick={skipReview}
                disabled={isGenerating}
                className="bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg"
              >
                Skip Review
              </button>
              <button
                onClick={generateTestCases}
                disabled={isGenerating}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-2 px-6 rounded-lg"
              >
                {isGenerating ? "Generating Test Cases..." : "🎯 Generate Test Cases"}
              </button>
            </div>
          </div>
        </div>

        {/* Category-based Element Display */}
        <div className="space-y-6">
          {Object.entries(CATEGORIES)
            .sort(([,a], [,b]) => a.priority - b.priority)
            .map(([categoryKey, categoryInfo]) => {
              const categoryElements = grouped[categoryKey];
              if (!categoryElements) return null;

              const isCollapsed = collapsedCategories.has(categoryKey);
              const counts = categoryCounts[categoryKey] || { total: 0, labeled: 0 };

              return (
                <div key={categoryKey} className="bg-white rounded-xl shadow-lg border-2 border-gray-200">
                  <div 
                    className={`px-6 py-4 border-b cursor-pointer hover:bg-gray-50 transition-colors bg-${categoryInfo.color}-50 border-${categoryInfo.color}-200`}
                    onClick={() => toggleCategory(categoryKey)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{categoryInfo.icon}</span>
                        <div>
                          <h2 className="text-lg font-bold text-gray-800">
                            {categoryInfo.label}
                          </h2>
                          <p className="text-sm text-gray-600">
                            {counts.labeled} of {counts.total} elements labeled
                            {categoryKey === 'data' && ' (grouped to reduce noise)'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium bg-${categoryInfo.color}-100 text-${categoryInfo.color}-800`}>
                          Priority {categoryInfo.priority}
                        </span>
                        <span className="text-gray-400">
                          {isCollapsed ? '▶️' : '🔽'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {!isCollapsed && (
                    <div className="p-6">
                      {categoryElements.map((elementGroup) => (
                        <div key={`${categoryKey}-${elementGroup.element.screenshotIndex}`} className="mb-6 last:mb-0">
                          <div className="mb-4 bg-gray-50 rounded-lg p-3">
                            <h3 className="font-semibold text-gray-800">
                              📱 {elementGroup.element.pageName || `Page ${elementGroup.element.screenshotIndex + 1}`}
                            </h3>
                            <p className="text-sm text-gray-600">
                              {elementGroup.texts.filter(t => t.label.trim()).length} of {elementGroup.texts.length} elements in this category
                            </p>
                          </div>
                          
                          <div className="grid gap-4">
                            {elementGroup.texts.map((text, textIndex) => {
                              const elementIndex = detectedElements.findIndex(e => e.screenshotIndex === elementGroup.element.screenshotIndex);
                              const textArrayIndex = detectedElements[elementIndex]?.detectedTexts.findIndex(t => t.id === text.id) || 0;

                              return (
                                <div 
                                  key={text.id} 
                                  className={`p-4 border rounded-xl transition-all ${
                                    text.label.trim() ? 'border-green-300 bg-green-50' : 'border-gray-200 hover:border-gray-300'
                                  } ${text.grouped ? 'border-l-4 border-l-blue-500' : ''}`}
                                >
                                  {text.grouped && (
                                    <div className="mb-3 bg-blue-50 rounded-lg p-3">
                                      <div className="font-medium text-blue-900">📦 Grouped Data Elements</div>
                                      <div className="text-sm text-blue-700 mt-1">
                                        This represents multiple similar items in your table/list. Examples: {text.examples?.join(', ') || 'Various entries'}
                                      </div>
                                    </div>
                                  )}
                                  
                                  <div className="grid grid-cols-12 gap-4 items-start">
                                    {/* Detected Text */}
                                    <div className="col-span-4">
                                      <label className="block text-xs font-medium text-gray-500 mb-2">
                                        {text.grouped ? 'Representative Data' : 'Detected Text'}
                                      </label>
                                      <div className="bg-gray-100 p-3 rounded-lg text-sm font-mono border">
                                        "{text.text}"
                                      </div>
                                      {text.priority && (
                                        <div className={`mt-2 text-xs px-2 py-1 rounded-full inline-block ${
                                          text.priority === 1 ? 'bg-red-100 text-red-800' :
                                          text.priority === 2 ? 'bg-orange-100 text-orange-800' :
                                          text.priority === 3 ? 'bg-yellow-100 text-yellow-800' :
                                          'bg-gray-100 text-gray-800'
                                        }`}>
                                          Priority {text.priority} {text.priority === 1 ? '(High)' : text.priority === 2 ? '(Medium)' : '(Low)'}
                                        </div>
                                      )}
                                    </div>
                                    
                                    {/* Element Type */}
                                    <div className="col-span-3">
                                      <label className="block text-xs font-medium text-gray-500 mb-2">
                                        Element Type
                                      </label>
                                      <select
                                        value={text.type}
                                        onChange={(e) => updateElementLabel(elementIndex, textArrayIndex, 'type', e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      >
                                        <option value="">Select type...</option>
                                        {UI_TYPES.filter(type => !text.grouped || type.category === 'data').map(type => (
                                          <option key={type.value} value={type.value}>
                                            {type.icon} {type.label}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    
                                    {/* User Label */}
                                    <div className="col-span-4">
                                      <label className="block text-xs font-medium text-gray-500 mb-2">
                                        Your Label {text.grouped ? '(for data group)' : '(optional)'}
                                      </label>
                                      <input
                                        type="text"
                                        value={text.label}
                                        onChange={(e) => updateElementLabel(elementIndex, textArrayIndex, 'label', e.target.value)}
                                        placeholder={text.grouped ? "e.g., 'Client Data Table'" : "e.g., 'Login Button', 'Email Field'"}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                    </div>
                                    
                                    {/* Status */}
                                    <div className="col-span-1 text-center">
                                      {text.label.trim() ? (
                                        <span className="text-green-600 text-xl">✅</span>
                                      ) : (
                                        <span className="text-gray-400 text-xl">⭕</span>
                                      )}
                                    </div>
                                  </div>
                                  
                                  {text.label.trim() && text.type && (
                                    <div className="mt-3 text-sm text-green-700 bg-green-100 p-3 rounded-lg">
                                      ✓ Will be referenced as: <strong>"{text.label}"</strong> ({UI_TYPES.find(t => t.value === text.type)?.label})
                                      {text.grouped && <span className="block mt-1 text-xs">This label will represent all similar data in this category</span>}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        <div className="mt-8 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold mb-3 text-gray-800">🚀 Ready to Generate Amazing Test Cases?</h3>
          <p className="text-gray-700 mb-6">
            Our smart filtering has organized your elements for maximum test case quality. 
            {stats.labeled > 0 && (
              <span className="text-green-600 font-semibold">
                {" "}Excellent! You've labeled {stats.labeled} elements for enhanced accuracy!
              </span>
            )}
          </p>
          <div className="flex justify-center space-x-6">
            <button
              onClick={skipReview}
              disabled={isGenerating}
              className="bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-xl shadow-lg transition-all"
            >
              Generate with AI Detection Only
            </button>
            <button
              onClick={generateTestCases}
              disabled={isGenerating}
              className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold py-3 px-8 rounded-xl shadow-xl transition-all transform hover:scale-105"
            >
              {isGenerating ? "🔄 Generating Test Cases..." : "🎯 Generate Professional Test Cases"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}