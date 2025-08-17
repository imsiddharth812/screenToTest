"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface DetectedText {
  id: string;
  text: string;
  label: string;
  type: string;
}

interface DetectedElement {
  screenshotIndex: number;
  detectedTexts: DetectedText[];
}

interface ReviewData {
  sessionId: string;
  detectedElements: DetectedElement[];
  requiresReview: boolean;
}

const UI_TYPES = [
  { value: 'button', label: 'Button', icon: '🔘' },
  { value: 'input', label: 'Input Field', icon: '📝' },
  { value: 'link', label: 'Link', icon: '🔗' },
  { value: 'text', label: 'Text/Label', icon: '📄' },
  { value: 'menu', label: 'Menu Item', icon: '📋' },
  { value: 'header', label: 'Header/Title', icon: '📌' },
  { value: 'error', label: 'Error Message', icon: '⚠️' },
  { value: 'success', label: 'Success Message', icon: '✅' },
  { value: 'checkbox', label: 'Checkbox', icon: '☑️' },
  { value: 'dropdown', label: 'Dropdown', icon: '⬇️' },
  { value: 'other', label: 'Other', icon: '❓' }
];

export default function Review() {
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [detectedElements, setDetectedElements] = useState<DetectedElement[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
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

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            📝 Review Detected Elements
          </h1>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-blue-800">
              <strong>💡 Smart Detection Preview:</strong> We've detected text elements from your screenshots. 
              Help us understand what each element represents by adding labels. This will make your test cases much more accurate!
            </p>
            <p className="text-sm text-blue-600 mt-2">
              Progress: {stats.labeled} of {stats.total} elements labeled 
              ({Math.round((stats.labeled / stats.total) * 100)}% complete)
            </p>
          </div>
          
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              💡 Tip: Focus on labeling buttons, input fields, and important text for best results
            </div>
            <div className="space-x-4">
              <button
                onClick={skipReview}
                disabled={isGenerating}
                className="bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded"
              >
                Skip Review
              </button>
              <button
                onClick={generateTestCases}
                disabled={isGenerating}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-2 px-6 rounded"
              >
                {isGenerating ? "Generating Test Cases..." : "Generate Test Cases"}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {detectedElements.map((element, elementIndex) => (
            <div key={`screenshot-${element.screenshotIndex}`} className="bg-white rounded-lg shadow-lg border">
              <div className="bg-gray-50 px-6 py-3 border-b">
                <h2 className="text-lg font-semibold text-gray-800">
                  📱 Screenshot {element.screenshotIndex + 1} - Detected Elements
                </h2>
                <p className="text-sm text-gray-600">
                  {element.detectedTexts.filter(t => t.label.trim()).length} of {element.detectedTexts.length} elements labeled
                </p>
              </div>
              
              <div className="p-6">
                {element.detectedTexts.length === 0 ? (
                  <p className="text-gray-500 italic">No text elements detected in this screenshot</p>
                ) : (
                  <div className="grid gap-4">
                    {element.detectedTexts.map((text, textIndex) => (
                      <div 
                        key={text.id} 
                        className={`p-4 border rounded-lg transition-all ${
                          text.label.trim() ? 'border-green-200 bg-green-50' : 'border-gray-200'
                        }`}
                      >
                        <div className="grid grid-cols-12 gap-4 items-center">
                          {/* Detected Text */}
                          <div className="col-span-4">
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                              Detected Text
                            </label>
                            <div className="bg-gray-100 p-2 rounded text-sm font-mono">
                              "{text.text}"
                            </div>
                          </div>
                          
                          {/* Element Type */}
                          <div className="col-span-3">
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                              Element Type
                            </label>
                            <select
                              value={text.type}
                              onChange={(e) => updateElementLabel(elementIndex, textIndex, 'type', e.target.value)}
                              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">Select type...</option>
                              {UI_TYPES.map(type => (
                                <option key={type.value} value={type.value}>
                                  {type.icon} {type.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          
                          {/* User Label */}
                          <div className="col-span-4">
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                              Your Label (Optional)
                            </label>
                            <input
                              type="text"
                              value={text.label}
                              onChange={(e) => updateElementLabel(elementIndex, textIndex, 'label', e.target.value)}
                              placeholder="e.g., 'Login Button', 'Email Field'"
                              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          
                          {/* Status */}
                          <div className="col-span-1 text-center">
                            {text.label.trim() ? (
                              <span className="text-green-600 text-lg">✅</span>
                            ) : (
                              <span className="text-gray-400 text-lg">⭕</span>
                            )}
                          </div>
                        </div>
                        
                        {text.label.trim() && text.type && (
                          <div className="mt-2 text-xs text-green-700 bg-green-100 p-2 rounded">
                            ✓ Will be referenced as: "{text.label}" ({UI_TYPES.find(t => t.value === text.type)?.label})
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-3">🚀 Ready to Generate?</h3>
          <p className="text-gray-600 mb-4">
            Your test cases will be much more accurate with the labels you've provided. 
            {stats.labeled > 0 && (
              <span className="text-green-600 font-medium">
                {" "}Great job labeling {stats.labeled} elements!
              </span>
            )}
          </p>
          <div className="flex justify-center space-x-4">
            <button
              onClick={skipReview}
              disabled={isGenerating}
              className="bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg"
            >
              Generate Without Labels
            </button>
            <button
              onClick={generateTestCases}
              disabled={isGenerating}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-8 rounded-lg"
            >
              {isGenerating ? "Generating Test Cases..." : "🎯 Generate Smart Test Cases"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}