'use client'

import { useState, useEffect } from 'react'
import Modal from './Modal'
import { scenariosApi, type Scenario, type CreateScenarioData, type UpdateScenarioData } from '../services'

// Testing intent options focused on functional testing
const TESTING_INTENTS = [
  {
    value: 'comprehensive',
    label: 'Comprehensive Testing',
    icon: '🎯',
    description: 'Full coverage including positive, negative, and edge cases'
  },
  {
    value: 'form-validation',
    label: 'Form Validation Focus',
    icon: '📝',
    description: 'Input validation, error handling, data types, and field interactions'
  },
  {
    value: 'user-journey',
    label: 'User Journey Testing',
    icon: '🚶',
    description: 'End-to-end workflows and multi-step processes'
  },
  {
    value: 'integration',
    label: 'Feature Integration',
    icon: '🔗',
    description: 'Component interactions and data flow testing'
  },
  {
    value: 'business-logic',
    label: 'Business Logic Validation',
    icon: '⚖️',
    description: 'Rules, calculations, and decision-making processes'
  }
]

const COVERAGE_LEVELS = [
  { value: 'essential', label: 'Essential Only', description: 'Core happy path scenarios' },
  { value: 'comprehensive', label: 'Comprehensive', description: 'Happy path + common edge cases' },
  { value: 'exhaustive', label: 'Exhaustive', description: 'Complete coverage including rare edge cases' }
]

const TEST_TYPE_OPTIONS = [
  { value: 'positive', label: 'Positive Testing', description: 'Valid inputs and expected flows' },
  { value: 'negative', label: 'Negative Testing', description: 'Invalid inputs and error conditions' },
  { value: 'edge_cases', label: 'Edge Cases', description: 'Boundary values and unusual scenarios' }
]

interface ScenarioModalProps {
  isOpen: boolean
  onClose: () => void
  mode: 'create' | 'edit'
  featureId?: number
  scenario?: Scenario
  onSuccess: (scenario: Scenario) => void
}

export default function ScenarioModal({ isOpen, onClose, mode, featureId, scenario, onSuccess }: ScenarioModalProps) {
  // Basic fields
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  
  // Enhanced fields
  const [testingIntent, setTestingIntent] = useState('comprehensive')
  const [coverageLevel, setCoverageLevel] = useState('comprehensive')
  const [testTypes, setTestTypes] = useState<string[]>(['positive', 'negative', 'edge_cases'])
  
  // Context fields
  const [activeContextTab, setActiveContextTab] = useState('user_story')
  const [userStory, setUserStory] = useState('')
  const [acceptanceCriteria, setAcceptanceCriteria] = useState('')
  const [businessRules, setBusinessRules] = useState('')
  const [edgeCases, setEdgeCases] = useState('')
  const [testEnvironment, setTestEnvironment] = useState('')
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && scenario) {
        setName(scenario.name)
        setDescription(scenario.description || '')
        setTestingIntent(scenario.testing_intent || 'comprehensive')
        setCoverageLevel(scenario.coverage_level || 'comprehensive')
        setTestTypes(scenario.test_types || ['positive', 'negative', 'edge_cases'])
        setUserStory(scenario.user_story || '')
        setAcceptanceCriteria(scenario.acceptance_criteria || '')
        setBusinessRules(scenario.business_rules || '')
        setEdgeCases(scenario.edge_cases || '')
        setTestEnvironment(scenario.test_environment || '')
      } else {
        // Reset to defaults
        setName('')
        setDescription('')
        setTestingIntent('comprehensive')
        setCoverageLevel('comprehensive')
        setTestTypes(['positive', 'negative', 'edge_cases'])
        setUserStory('')
        setAcceptanceCriteria('')
        setBusinessRules('')
        setEdgeCases('')
        setTestEnvironment('')
      }
      setError('')
    }
  }, [isOpen, mode, scenario])

  const handleTestTypeChange = (testType: string) => {
    setTestTypes(prev => 
      prev.includes(testType)
        ? prev.filter(t => t !== testType)
        : [...prev, testType]
    )
  }

  const getEstimatedTestCases = () => {
    const baseMultipliers = {
      'form-validation': 15,
      'user-journey': 8,
      'integration': 12,
      'business-logic': 10,
      'comprehensive': 18
    }
    
    const coverageMultipliers = {
      'essential': 0.6,
      'comprehensive': 1.0,
      'exhaustive': 1.4
    }
    
    const base = baseMultipliers[testingIntent as keyof typeof baseMultipliers] || 12
    const coverage = coverageMultipliers[coverageLevel as keyof typeof coverageMultipliers] || 1.0
    const typeMultiplier = testTypes.length * 0.3 + 0.4
    
    return Math.round(base * coverage * typeMultiplier)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Scenario name is required')
      return
    }

    setLoading(true)

    try {
      const data: CreateScenarioData | UpdateScenarioData = {
        name: name.trim(),
        description: description.trim() || undefined,
        testing_intent: testingIntent,
        user_story: userStory.trim() || undefined,
        acceptance_criteria: acceptanceCriteria.trim() || undefined,
        business_rules: businessRules.trim() || undefined,
        edge_cases: edgeCases.trim() || undefined,
        test_environment: testEnvironment.trim() || undefined,
        coverage_level: coverageLevel,
        test_types: testTypes
      }

      let result: { scenario: Scenario }

      if (mode === 'create') {
        if (!featureId) {
          throw new Error('Feature ID is required for creating a scenario')
        }
        result = await scenariosApi.create(featureId, data as CreateScenarioData)
      } else if (scenario) {
        result = await scenariosApi.update(scenario.id, data as UpdateScenarioData)
      } else {
        throw new Error('Invalid scenario data')
      }

      onSuccess(result.scenario)
      onClose()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      onClose()
    }
  }

  const selectedIntent = TESTING_INTENTS.find(intent => intent.value === testingIntent)
  const estimatedTests = getEstimatedTestCases()

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={mode === 'create' ? 'Create Scenario' : 'Edit Scenario'}
      maxWidth="max-w-4xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            📝 Basic Information
          </h3>
          
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label htmlFor="scenarioName" className="block text-sm font-medium text-gray-700 mb-2">
                Scenario Name *
              </label>
              <input
                type="text"
                id="scenarioName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="e.g., Login Form Validation, User Registration Flow"
                maxLength={150}
              />
            </div>

            <div>
              <label htmlFor="scenarioDescription" className="block text-sm font-medium text-gray-700 mb-2">
                Brief Description
              </label>
              <textarea
                id="scenarioDescription"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={loading}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="Brief overview of what this scenario covers"
              />
            </div>
          </div>
        </div>

        {/* Testing Intent */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            🎯 Testing Focus
          </h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Primary Testing Intent
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {TESTING_INTENTS.map((intent) => (
                <label key={intent.value} className="cursor-pointer">
                  <input
                    type="radio"
                    name="testingIntent"
                    value={intent.value}
                    checked={testingIntent === intent.value}
                    onChange={(e) => setTestingIntent(e.target.value)}
                    className="sr-only"
                  />
                  <div className={`p-4 rounded-lg border-2 transition-all ${
                    testingIntent === intent.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{intent.icon}</span>
                      <span className="font-medium text-sm">{intent.label}</span>
                    </div>
                    <p className="text-xs text-gray-600">{intent.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Test Generation Settings */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-4">
            <h4 className="font-medium text-gray-800">Test Generation Settings</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Coverage Level
                </label>
                <select
                  value={coverageLevel}
                  onChange={(e) => setCoverageLevel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {COVERAGE_LEVELS.map(level => (
                    <option key={level.value} value={level.value}>
                      {level.label} - {level.description}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Test Types to Include
                </label>
                <div className="space-y-2">
                  {TEST_TYPE_OPTIONS.map(type => (
                    <label key={type.value} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={testTypes.includes(type.value)}
                        onChange={() => handleTestTypeChange(type.value)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="font-medium">{type.label}</span>
                      <span className="text-gray-500">- {type.description}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Estimation Preview */}
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                <strong>Estimated Test Cases:</strong> ~{estimatedTests} test cases will be generated based on your settings
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Focus: {selectedIntent?.label} • Coverage: {coverageLevel} • Types: {testTypes.length}
              </p>
            </div>
          </div>
        </div>

        {/* Context & Requirements */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            📋 Context & Requirements
          </h3>
          
          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { key: 'user_story', label: 'User Story', icon: '👤' },
                { key: 'acceptance_criteria', label: 'Acceptance Criteria', icon: '✅' },
                { key: 'business_rules', label: 'Business Rules', icon: '⚖️' },
                { key: 'edge_cases', label: 'Edge Cases', icon: '🔍' },
                { key: 'environment', label: 'Test Environment', icon: '🖥️' }
              ].map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveContextTab(tab.key)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeContextTab === tab.key
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="flex items-center gap-1">
                    <span>{tab.icon}</span>
                    {tab.label}
                  </span>
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="min-h-[120px]">
            {activeContextTab === 'user_story' && (
              <div>
                <label htmlFor="userStory" className="block text-sm font-medium text-gray-700 mb-2">
                  User Story (Optional)
                </label>
                <textarea
                  id="userStory"
                  value={userStory}
                  onChange={(e) => setUserStory(e.target.value)}
                  disabled={loading}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                  placeholder="As a [user type], I want [goal] so that [benefit]..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Paste your Jira user story or requirement description here
                </p>
              </div>
            )}

            {activeContextTab === 'acceptance_criteria' && (
              <div>
                <label htmlFor="acceptanceCriteria" className="block text-sm font-medium text-gray-700 mb-2">
                  Acceptance Criteria (Optional)
                </label>
                <textarea
                  id="acceptanceCriteria"
                  value={acceptanceCriteria}
                  onChange={(e) => setAcceptanceCriteria(e.target.value)}
                  disabled={loading}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                  placeholder="Given [context], When [action], Then [expected result]..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Define the conditions that must be met for this scenario to be considered complete
                </p>
              </div>
            )}

            {activeContextTab === 'business_rules' && (
              <div>
                <label htmlFor="businessRules" className="block text-sm font-medium text-gray-700 mb-2">
                  Business Rules (Optional)
                </label>
                <textarea
                  id="businessRules"
                  value={businessRules}
                  onChange={(e) => setBusinessRules(e.target.value)}
                  disabled={loading}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                  placeholder="Business logic, validations, calculations, or constraints that apply..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Document business logic that affects testing scenarios
                </p>
              </div>
            )}

            {activeContextTab === 'edge_cases' && (
              <div>
                <label htmlFor="edgeCases" className="block text-sm font-medium text-gray-700 mb-2">
                  Edge Cases & Special Scenarios (Optional)
                </label>
                <textarea
                  id="edgeCases"
                  value={edgeCases}
                  onChange={(e) => setEdgeCases(e.target.value)}
                  disabled={loading}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                  placeholder="Unusual conditions, boundary cases, error scenarios to consider..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Specify edge cases and unusual scenarios that should be tested
                </p>
              </div>
            )}

            {activeContextTab === 'environment' && (
              <div>
                <label htmlFor="testEnvironment" className="block text-sm font-medium text-gray-700 mb-2">
                  Test Environment Details (Optional)
                </label>
                <textarea
                  id="testEnvironment"
                  value={testEnvironment}
                  onChange={(e) => setTestEnvironment(e.target.value)}
                  disabled={loading}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                  placeholder="Browser requirements, test data setup, environment configurations..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Specify environment setup requirements and constraints
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="flex-2 px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : mode === 'create' ? '🎯 Create Scenario' : '🎯 Update Scenario'}
          </button>
        </div>
      </form>
    </Modal>
  )
}