'use client'

import { useState, useEffect, useCallback } from 'react'
import SecureImage from './SecureImage'
import Toast from './Toast'
import { type Scenario, type Feature, type Project } from '../services'

interface UploadedFile {
  id: string
  file: File | null
  preview: string
  originalName: string
  customName: string
  isExisting?: boolean
  screenshotId?: number
}

interface ScenarioTabsProps {
  scenario: Scenario
  feature: Feature | null
  project: Project | null
  onScenarioUpdate: (scenario: Scenario) => void
}

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

export default function ScenarioTabs({ scenario, feature, project, onScenarioUpdate }: ScenarioTabsProps) {
  const [activeTab, setActiveTab] = useState('configuration')
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [testCases, setTestCases] = useState<any>(null)
  const [activeContextTab, setActiveContextTab] = useState('user_story')
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [expandedTestCases, setExpandedTestCases] = useState<Set<number>>(new Set())
  
  // Toast notifications
  const [toast, setToast] = useState<{
    isOpen: boolean
    message: string
    type: 'success' | 'error' | 'info'
  }>({ isOpen: false, message: '', type: 'info' })
  
  const [isSaving, setIsSaving] = useState(false)
  
  // Success message state for test case generation
  const [successMessage, setSuccessMessage] = useState<{
    isVisible: boolean
    message: string
  }>({ isVisible: false, message: '' })
  
  // Screenshot maximize state
  const [maximizedScreenshot, setMaximizedScreenshot] = useState<{
    isOpen: boolean
    file: UploadedFile | null
    index: number | null
  }>({ isOpen: false, file: null, index: null })
  
  // Configuration state
  const [formData, setFormData] = useState({
    name: scenario.name || '',
    description: scenario.description || '',
    testing_intent: scenario.testing_intent || 'comprehensive',
    coverage_level: scenario.coverage_level || 'comprehensive',
    test_types: scenario.test_types || ['positive', 'negative', 'edge_cases'],
    ai_model: scenario.ai_model || 'gpt-4-vision',
    user_story: scenario.user_story || '',
    acceptance_criteria: scenario.acceptance_criteria || '',
    business_rules: scenario.business_rules || '',
    edge_cases: scenario.edge_cases || '',
    test_environment: scenario.test_environment || ''
  })

  // Original/saved data for change detection
  const [originalFormData, setOriginalFormData] = useState({
    name: scenario.name || '',
    description: scenario.description || '',
    testing_intent: scenario.testing_intent || 'comprehensive',
    coverage_level: scenario.coverage_level || 'comprehensive',
    test_types: scenario.test_types || ['positive', 'negative', 'edge_cases'],
    ai_model: scenario.ai_model || 'gpt-4-vision',
    user_story: scenario.user_story || '',
    acceptance_criteria: scenario.acceptance_criteria || '',
    business_rules: scenario.business_rules || '',
    edge_cases: scenario.edge_cases || '',
    test_environment: scenario.test_environment || ''
  })

  // Change detection state
  const [unsavedChanges, setUnsavedChanges] = useState({
    configuration: false,
    screenshots: false,
    context: false
  })

  // Warning modal state
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false)
  const [pendingTabSwitch, setPendingTabSwitch] = useState<string | null>(null)
  
  // Track if changes were recently saved (not discarded)
  const [recentlySaved, setRecentlySaved] = useState(false)
  

  // Change detection utility functions
  const areArraysEqual = (arr1: string[], arr2: string[]): boolean => {
    if (arr1.length !== arr2.length) return false
    return arr1.every((item, index) => item === arr2[index])
  }

  const hasConfigurationChanges = (): boolean => {
    return (
      formData.name !== originalFormData.name ||
      formData.description !== originalFormData.description ||
      formData.testing_intent !== originalFormData.testing_intent ||
      formData.coverage_level !== originalFormData.coverage_level ||
      !areArraysEqual(formData.test_types, originalFormData.test_types) ||
      formData.ai_model !== originalFormData.ai_model
    )
  }

  const hasContextChanges = (): boolean => {
    return (
      formData.user_story !== originalFormData.user_story ||
      formData.acceptance_criteria !== originalFormData.acceptance_criteria ||
      formData.business_rules !== originalFormData.business_rules ||
      formData.edge_cases !== originalFormData.edge_cases ||
      formData.test_environment !== originalFormData.test_environment
    )
  }

  const hasAnyUnsavedChanges = (): boolean => {
    return hasConfigurationChanges() || hasContextChanges()
  }

  // Field-level change detection
  const isFieldChanged = (field: keyof typeof formData): boolean => {
    if (Array.isArray(formData[field]) && Array.isArray(originalFormData[field])) {
      return !areArraysEqual(formData[field] as string[], originalFormData[field] as string[])
    }
    return formData[field] !== originalFormData[field]
  }

  // Update unsaved changes state whenever formData changes
  useEffect(() => {
    const hasChanges = hasConfigurationChanges() || hasContextChanges()
    
    setUnsavedChanges({
      configuration: hasConfigurationChanges(),
      screenshots: false, // Screenshots auto-save, so no unsaved changes
      context: hasContextChanges()
    })
    
    // Reset recentlySaved when new changes are made
    if (hasChanges) {
      setRecentlySaved(false)
    }
  }, [formData, originalFormData])
  
  // Auto-hide "All changes saved" message after 5 seconds
  useEffect(() => {
    if (recentlySaved) {
      const timeout = setTimeout(() => {
        setRecentlySaved(false)
      }, 5000) // Hide after 5 seconds
      
      return () => clearTimeout(timeout)
    }
  }, [recentlySaved])

  // Remove auto-save functionality - only save when user clicks Save button

  // Load existing screenshots and test cases when scenario changes
  useEffect(() => {
    loadExistingScreenshots()
    loadExistingTestCases()
  }, [scenario.id])

  // Keyboard shortcuts handler
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // ESC key for closing maximized screenshot
      if (event.key === 'Escape' && maximizedScreenshot.isOpen) {
        setMaximizedScreenshot({ isOpen: false, file: null, index: null })
        return
      }
      
      // Ctrl+S / Cmd+S for saving
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault()
        
        if (activeTab === 'configuration') {
          handleSaveConfiguration()
        } else if (activeTab === 'context') {
          // Save based on the active context tab
          switch (activeContextTab) {
            case 'user_story':
              handleSaveUserStory()
              break
            case 'acceptance_criteria':
              handleSaveAcceptanceCriteria()
              break
            case 'business_rules':
              handleSaveBusinessRules()
              break
            case 'edge_cases':
              handleSaveEdgeCases()
              break
            case 'environment':
              handleSaveTestEnvironment()
              break
          }
        }
        return
      }
    }

    document.addEventListener('keydown', handleKeyPress)
    return () => {
      document.removeEventListener('keydown', handleKeyPress)
    }
  }, [maximizedScreenshot.isOpen, activeTab, activeContextTab, hasAnyUnsavedChanges()])

  // Browser beforeunload protection for unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasAnyUnsavedChanges()) {
        e.preventDefault()
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?'
        return 'You have unsaved changes. Are you sure you want to leave?'
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [hasAnyUnsavedChanges()])

  // Sync formData with scenario props when scenario changes
  useEffect(() => {
    const newData = {
      name: scenario.name || '',
      description: scenario.description || '',
      testing_intent: scenario.testing_intent || 'comprehensive',
      coverage_level: scenario.coverage_level || 'comprehensive',
      test_types: scenario.test_types || ['positive', 'negative', 'edge_cases'],
      ai_model: scenario.ai_model || 'gpt-4-vision',
      user_story: scenario.user_story || '',
      acceptance_criteria: scenario.acceptance_criteria || '',
      business_rules: scenario.business_rules || '',
      edge_cases: scenario.edge_cases || '',
      test_environment: scenario.test_environment || ''
    }
    setFormData(newData)
    setOriginalFormData(newData) // Also update original data when scenario changes
  }, [scenario])

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ isOpen: true, message, type })
  }

  const loadExistingScreenshots = async () => {
    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch(`http://localhost:3001/api/scenarios/${scenario.id}/screenshots`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (response.ok) {
        const data = await response.json()
        const existingFiles: UploadedFile[] = data.screenshots.map((screenshot: any) => ({
          id: screenshot.id.toString(),
          file: null,
          preview: `http://localhost:3001/api/screenshots/${screenshot.id}`,
          originalName: screenshot.original_name,
          customName: screenshot.custom_name || screenshot.original_name.replace(/\.[^/.]+$/, ''),
          isExisting: true,
          screenshotId: screenshot.id
        }))
        
        setFiles(existingFiles)
      } else {
        setFiles([])
      }
    } catch (error) {
      console.error('Error loading existing screenshots:', error)
      setFiles([])
    }
  }

  const loadExistingTestCases = async () => {
    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch(`http://localhost:3001/api/scenarios/${scenario.id}/test-cases`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.testCases && data.testCases.length > 0) {
          // Get the latest test case set (first item since they're ordered by updated_at DESC)
          const latestTestCase = data.testCases[0]
          
          // Extract test cases - they might be in different properties
          let actualTestCases = []
          
          if (Array.isArray(latestTestCase.testCases)) {
            // Direct array
            actualTestCases = latestTestCase.testCases
          } else if (latestTestCase.testCases && typeof latestTestCase.testCases === 'object') {
            // Object with nested properties
            if (latestTestCase.testCases.allTestCases) {
              actualTestCases = latestTestCase.testCases.allTestCases
            } else if (latestTestCase.testCases.testCases) {
              actualTestCases = latestTestCase.testCases.testCases
            } else {
              // Maybe it's an object that itself is the test cases array structure
              actualTestCases = [latestTestCase.testCases]
            }
          } else if (typeof latestTestCase.testCases === 'string') {
            // JSON string - parse it
            try {
              const parsed = JSON.parse(latestTestCase.testCases)
              
              if (Array.isArray(parsed)) {
                actualTestCases = parsed
              } else if (parsed.allTestCases) {
                actualTestCases = parsed.allTestCases
              } else if (parsed.testCases) {
                actualTestCases = parsed.testCases
              } else {
                actualTestCases = [parsed] // Single test case
              }
            } catch (e) {
              console.error('Failed to parse test cases JSON:', e)
            }
          }
          
          const testCaseData = {
            testCases: actualTestCases, // This will be the actual array
            timestamp: latestTestCase.createdAt,
            id: latestTestCase.id,
            scenarioId: latestTestCase.scenarioId,
            analysisType: latestTestCase.analysisType,
            totalCount: latestTestCase.totalCount,
            functionalCount: latestTestCase.functionalCount,
            endToEndCount: latestTestCase.endToEndCount,
            integrationCount: latestTestCase.integrationCount,
            uiCount: latestTestCase.uiCount,
            createdAt: latestTestCase.createdAt,
            updatedAt: latestTestCase.updatedAt
            // Don't spread latestTestCase to avoid overwriting testCases property
          }
          
          setTestCases(testCaseData)
        }
      }
    } catch (error) {
      console.error('Error loading existing test cases:', error)
    }
  }

  const handleSaveConfiguration = async () => {
    setIsSaving(true)
    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch(`http://localhost:3001/api/scenarios/${scenario.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })
      
      if (response.ok) {
        const updatedScenario = await response.json()
        onScenarioUpdate(updatedScenario.scenario)
        // Update original data to reflect saved state
        setOriginalFormData(prev => ({ ...prev, ...formData }))
        setRecentlySaved(true)
        showToast('Configuration saved successfully!', 'success')
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error occurred' }))
        showToast(`Failed to save configuration: ${errorData.error}`, 'error')
      }
    } catch (error) {
      console.error('Error saving configuration:', error)
      showToast('Error saving configuration. Please try again.', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  // Individual save functions for each context field
  const handleSaveUserStory = async () => {
    setIsSaving(true)
    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch(`http://localhost:3001/api/scenarios/${scenario.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name,
          description: scenario.description,
          testing_intent: scenario.testing_intent,
          coverage_level: scenario.coverage_level,
          test_types: scenario.test_types,
          user_story: formData.user_story, // Only this field gets updated
          acceptance_criteria: scenario.acceptance_criteria,
          business_rules: scenario.business_rules,
          edge_cases: scenario.edge_cases,
          test_environment: scenario.test_environment
        })
      })
      
      if (response.ok) {
        const updatedScenario = await response.json()
        onScenarioUpdate(updatedScenario.scenario)
        // Update original data to reflect saved state
        setOriginalFormData(prev => ({ ...prev, user_story: formData.user_story }))
        setRecentlySaved(true)
        showToast('User Story saved successfully!', 'success')
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error occurred' }))
        showToast(`Failed to save User Story: ${errorData.error}`, 'error')
      }
    } catch (error) {
      console.error('Error saving User Story:', error)
      showToast('Error saving User Story. Please try again.', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveAcceptanceCriteria = async () => {
    setIsSaving(true)
    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch(`http://localhost:3001/api/scenarios/${scenario.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name,
          description: scenario.description,
          testing_intent: scenario.testing_intent,
          coverage_level: scenario.coverage_level,
          test_types: scenario.test_types,
          user_story: scenario.user_story,
          acceptance_criteria: formData.acceptance_criteria, // Only this field gets updated
          business_rules: scenario.business_rules,
          edge_cases: scenario.edge_cases,
          test_environment: scenario.test_environment
        })
      })
      
      if (response.ok) {
        const updatedScenario = await response.json()
        onScenarioUpdate(updatedScenario.scenario)
        // Update original data to reflect saved state
        setOriginalFormData(prev => ({ ...prev, acceptance_criteria: formData.acceptance_criteria }))
        setRecentlySaved(true)
        showToast('Acceptance Criteria saved successfully!', 'success')
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error occurred' }))
        showToast(`Failed to save Acceptance Criteria: ${errorData.error}`, 'error')
      }
    } catch (error) {
      console.error('Error saving Acceptance Criteria:', error)
      showToast('Error saving Acceptance Criteria. Please try again.', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveBusinessRules = async () => {
    setIsSaving(true)
    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch(`http://localhost:3001/api/scenarios/${scenario.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name,
          description: scenario.description,
          testing_intent: scenario.testing_intent,
          coverage_level: scenario.coverage_level,
          test_types: scenario.test_types,
          user_story: scenario.user_story,
          acceptance_criteria: scenario.acceptance_criteria,
          business_rules: formData.business_rules, // Only this field gets updated
          edge_cases: scenario.edge_cases,
          test_environment: scenario.test_environment
        })
      })
      
      if (response.ok) {
        const updatedScenario = await response.json()
        onScenarioUpdate(updatedScenario.scenario)
        // Update original data to reflect saved state
        setOriginalFormData(prev => ({ ...prev, business_rules: formData.business_rules }))
        setRecentlySaved(true)
        showToast('Business Rules saved successfully!', 'success')
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error occurred' }))
        showToast(`Failed to save Business Rules: ${errorData.error}`, 'error')
      }
    } catch (error) {
      console.error('Error saving Business Rules:', error)
      showToast('Error saving Business Rules. Please try again.', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveEdgeCases = async () => {
    setIsSaving(true)
    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch(`http://localhost:3001/api/scenarios/${scenario.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name,
          description: scenario.description,
          testing_intent: scenario.testing_intent,
          coverage_level: scenario.coverage_level,
          test_types: scenario.test_types,
          user_story: scenario.user_story,
          acceptance_criteria: scenario.acceptance_criteria,
          business_rules: scenario.business_rules,
          edge_cases: formData.edge_cases, // Only this field gets updated
          test_environment: scenario.test_environment
        })
      })
      
      if (response.ok) {
        const updatedScenario = await response.json()
        onScenarioUpdate(updatedScenario.scenario)
        // Update original data to reflect saved state
        setOriginalFormData(prev => ({ ...prev, edge_cases: formData.edge_cases }))
        setRecentlySaved(true)
        showToast('Edge Cases saved successfully!', 'success')
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error occurred' }))
        showToast(`Failed to save Edge Cases: ${errorData.error}`, 'error')
      }
    } catch (error) {
      console.error('Error saving Edge Cases:', error)
      showToast('Error saving Edge Cases. Please try again.', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveTestEnvironment = async () => {
    setIsSaving(true)
    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch(`http://localhost:3001/api/scenarios/${scenario.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name,
          description: scenario.description,
          testing_intent: scenario.testing_intent,
          coverage_level: scenario.coverage_level,
          test_types: scenario.test_types,
          user_story: scenario.user_story,
          acceptance_criteria: scenario.acceptance_criteria,
          business_rules: scenario.business_rules,
          edge_cases: scenario.edge_cases,
          test_environment: formData.test_environment // Only this field gets updated
        })
      })
      
      if (response.ok) {
        const updatedScenario = await response.json()
        onScenarioUpdate(updatedScenario.scenario)
        // Update original data to reflect saved state
        setOriginalFormData(prev => ({ ...prev, test_environment: formData.test_environment }))
        setRecentlySaved(true)
        showToast('Test Environment saved successfully!', 'success')
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error occurred' }))
        showToast(`Failed to save Test Environment: ${errorData.error}`, 'error')
      }
    } catch (error) {
      console.error('Error saving Test Environment:', error)
      showToast('Error saving Test Environment. Please try again.', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  // Handle tab switching with unsaved changes protection
  const handleTabSwitch = (newTab: string) => {
    // Allow switching to same tab
    if (newTab === activeTab) return
    
    // If switching away from configuration or context tabs with unsaved changes
    if (hasAnyUnsavedChanges() && (activeTab === 'configuration' || activeTab === 'context')) {
      setPendingTabSwitch(newTab)
      setShowUnsavedWarning(true)
      return
    }
    
    // Normal tab switch
    setActiveTab(newTab)
    // Hide success message when user navigates to test-cases tab
    if (newTab === 'test-cases' && successMessage.isVisible) {
      setSuccessMessage({ isVisible: false, message: '' })
    }
  }

  // Handle unsaved warning modal actions
  const handleSaveAndSwitch = async () => {
    if (pendingTabSwitch) {
      // Save based on current tab and what has changes
      if (activeTab === 'configuration' && hasConfigurationChanges()) {
        await handleSaveConfiguration()
      } else if (activeTab === 'context' && hasContextChanges()) {
        // Save all context fields at once
        setIsSaving(true)
        try {
          const token = localStorage.getItem('authToken')
          const response = await fetch(`http://localhost:3001/api/scenarios/${scenario.id}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              name: formData.name,
              description: scenario.description,
              testing_intent: scenario.testing_intent,
              coverage_level: scenario.coverage_level,
              test_types: scenario.test_types,
              ai_model: scenario.ai_model,
              user_story: formData.user_story,
              acceptance_criteria: formData.acceptance_criteria,
              business_rules: formData.business_rules,
              edge_cases: formData.edge_cases,
              test_environment: formData.test_environment
            })
          })
          
          if (response.ok) {
            const updatedScenario = await response.json()
            onScenarioUpdate(updatedScenario.scenario)
            // Update original data to reflect saved state
            setOriginalFormData({ ...formData })
            setRecentlySaved(true)
            showToast('Context & Requirements saved successfully!', 'success')
          } else {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error occurred' }))
            showToast(`Failed to save: ${errorData.error}`, 'error')
            return
          }
        } catch (error) {
          console.error('Error saving:', error)
          showToast('Error saving. Please try again.', 'error')
          return
        } finally {
          setIsSaving(false)
        }
      }
      
      setActiveTab(pendingTabSwitch)
      if (pendingTabSwitch === 'test-cases' && successMessage.isVisible) {
        setSuccessMessage({ isVisible: false, message: '' })
      }
    }
    setShowUnsavedWarning(false)
    setPendingTabSwitch(null)
  }

  const handleDiscardAndSwitch = () => {
    if (pendingTabSwitch) {
      // Revert to original data
      setFormData({ ...originalFormData })
      // Explicitly set recentlySaved to false since we're discarding, not saving
      setRecentlySaved(false)
      setActiveTab(pendingTabSwitch)
      if (pendingTabSwitch === 'test-cases' && successMessage.isVisible) {
        setSuccessMessage({ isVisible: false, message: '' })
      }
    }
    setShowUnsavedWarning(false)
    setPendingTabSwitch(null)
  }

  const handleCancelSwitch = () => {
    setShowUnsavedWarning(false)
    setPendingTabSwitch(null)
  }


  const handleFiles = useCallback(async (newFiles: File[]) => {
    const imageFiles = newFiles.filter(file => file.type.startsWith('image/'))
    
    if (files.length + imageFiles.length > 25) {
      showToast('Maximum 25 screenshots allowed', 'error')
      return
    }

    const newUploadedFiles = imageFiles.map(file => ({
      id: Math.random().toString(36).substring(2, 11),
      file,
      preview: URL.createObjectURL(file),
      originalName: file.name,
      customName: file.name.replace(/\.[^/.]+$/, ''),
      isExisting: false
    }))

    setFiles(prev => [...prev, ...newUploadedFiles])

    // Auto-upload new files
    for (const uploadedFile of newUploadedFiles) {
      try {
        const formData = new FormData()
        if (uploadedFile.file) {
          formData.append('screenshot', uploadedFile.file)
          formData.append('description', uploadedFile.customName)

          const token = localStorage.getItem('authToken')
          const response = await fetch(`http://localhost:3001/api/scenarios/${scenario.id}/screenshots`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            },
            body: formData,
          })

          if (response.ok) {
            const result = await response.json()
            // Update the file to mark it as existing with the server ID
            setFiles(prev => prev.map(f => 
              f.id === uploadedFile.id 
                ? { ...f, isExisting: true, screenshotId: result.screenshot.id }
                : f
            ))
            showToast(`Screenshot "${uploadedFile.originalName}" uploaded successfully`, 'success')
          }
        }
      } catch (error) {
        console.error('Error uploading screenshot:', error)
        showToast(`Failed to upload "${uploadedFile.originalName}"`, 'error')
      }
    }
  }, [files.length, scenario.id])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFiles = Array.from(e.dataTransfer.files)
    handleFiles(droppedFiles)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      handleFiles(selectedFiles)
    }
  }

  // Image drag and drop reordering handlers
  const handleImageDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleImageDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex !== null && draggedIndex !== index) {
      e.dataTransfer.dropEffect = 'move'
    }
  }

  const handleImageDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex !== null && draggedIndex !== index) {
      moveFile(draggedIndex, index)
    }
  }

  const handleImageDragEnd = () => {
    setDraggedIndex(null)
  }

  const moveFile = async (fromIndex: number, toIndex: number) => {
    const updatedFiles = [...files]
    const [removed] = updatedFiles.splice(fromIndex, 1)
    updatedFiles.splice(toIndex, 0, removed)
    setFiles(updatedFiles)
    
    // Persist the new order to the server
    await persistScreenshotOrder(updatedFiles)
  }

  const persistScreenshotOrder = async (orderedFiles: UploadedFile[]) => {
    try {
      const screenshotIds = orderedFiles
        .filter(file => file.screenshotId) // Only include existing screenshots
        .map(file => file.screenshotId)
      
      if (screenshotIds.length === 0) return
      
      const token = localStorage.getItem('authToken')
      const response = await fetch(`http://localhost:3001/api/scenarios/${scenario.id}/screenshots/reorder`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ screenshotIds })
      })
      
      if (response.ok) {
        // Screenshot order saved successfully
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('Failed to persist screenshot order:', errorData)
        showToast(`Failed to save screenshot order: ${errorData.error}`, 'error')
      }
    } catch (error) {
      console.error('Error persisting screenshot order:', error)
      showToast('Failed to save screenshot order. Please try again.', 'error')
    }
  }

  const removeFile = async (index: number) => {
    const fileToRemove = files[index]
    
    if (fileToRemove.isExisting && fileToRemove.screenshotId) {
      try {
        const token = localStorage.getItem('authToken')
        await fetch(`http://localhost:3001/api/screenshots/${fileToRemove.screenshotId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        })
        showToast('Screenshot deleted successfully', 'success')
      } catch (error) {
        console.error('Error deleting screenshot:', error)
        showToast('Failed to delete screenshot', 'error')
        return
      }
    }

    // Clean up preview URL for new files
    if (!fileToRemove.isExisting && fileToRemove.preview.startsWith('blob:')) {
      URL.revokeObjectURL(fileToRemove.preview)
    }

    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const updateFileName = async (index: number, newName: string) => {
    const updatedFiles = [...files]
    updatedFiles[index].customName = newName
    setFiles(updatedFiles)

    // Update on server if it's an existing file
    const file = updatedFiles[index]
    if (file.isExisting && file.screenshotId) {
      try {
        const token = localStorage.getItem('authToken')
        const response = await fetch(`http://localhost:3001/api/screenshots/${file.screenshotId}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ custom_name: newName })
        })
        
        if (response.ok) {
          // Screenshot name updated successfully
        } else {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
          console.error('Failed to update screenshot name:', errorData)
          showToast(`Failed to save page description: ${errorData.error}`, 'error')
          
          // Revert local change if server update fails
          const revertedFiles = [...files]
          revertedFiles[index].customName = file.customName
          setFiles(revertedFiles)
        }
      } catch (error) {
        console.error('Error updating screenshot name:', error)
        showToast('Failed to save page description. Please try again.', 'error')
        
        // Revert local change if server update fails
        const revertedFiles = [...files]
        revertedFiles[index].customName = file.customName
        setFiles(revertedFiles)
      }
    }
  }

  const generateTestCases = async () => {
    if (files.length === 0) {
      showToast('Please upload at least one screenshot', 'error')
      return
    }

    setIsGenerating(true)
    try {
      const requestFormData = new FormData()
      requestFormData.append('scenarioId', scenario.id.toString())
      requestFormData.append('testingIntent', formData.testing_intent || 'comprehensive')
      requestFormData.append('aiModel', formData.ai_model || 'claude')
      
      // Add screenshot IDs for existing files
      files.forEach(file => {
        if (file.screenshotId) {
          requestFormData.append('screenshotIds[]', file.screenshotId.toString())
        }
      })

      const token = localStorage.getItem('authToken')
      const response = await fetch('http://localhost:3001/api/generate-testcases', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: requestFormData
      })

      if (response.ok) {
        const result = await response.json()
        // Set test cases with the fresh results and add generation timestamp
        const testCaseData = {
          ...result,
          timestamp: new Date().toISOString(),
          generatedAt: new Date().toISOString(),
          generationId: Math.random().toString(36).substring(2, 15),
          aiModel: formData.ai_model || 'claude' // Store AI model for regeneration
        }
        setTestCases(testCaseData)
        // Switch to test-cases tab
        setActiveTab('test-cases')
        // Show more prominent success message instead of toast
        setSuccessMessage({
          isVisible: true,
          message: 'Test cases generated successfully! You can view them below.'
        })
      } else {
        const errorData = await response.json()
        showToast(errorData.error || 'Failed to generate test cases', 'error')
      }
    } catch (error) {
      console.error('Error generating test cases:', error)
      showToast('Error generating test cases. Please try again.', 'error')
    } finally {
      setIsGenerating(false)
    }
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
    
    const base = baseMultipliers[formData.testing_intent as keyof typeof baseMultipliers] || 12
    const coverage = coverageMultipliers[formData.coverage_level as keyof typeof coverageMultipliers] || 1.0
    const typeMultiplier = formData.test_types.length * 0.3 + 0.4
    
    return Math.round(base * coverage * typeMultiplier)
  }

  const handleTestTypeChange = (testType: string) => {
    setFormData(prev => ({
      ...prev,
      test_types: prev.test_types.includes(testType)
        ? prev.test_types.filter(t => t !== testType)
        : [...prev.test_types, testType]
    }))
  }

  const toggleTestCase = (index: number) => {
    setExpandedTestCases(prev => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
  }

  const navigateToResults = () => {
    if (testCases && (testCases.testCases || testCases.allTestCases)) {
      // Format data for Results page - it expects allTestCases, not testCases
      const actualTestCases = testCases.testCases || testCases.allTestCases
      
      const testCaseData = {
        ...testCases,
        allTestCases: actualTestCases, // Results page expects this property name
        testCases: actualTestCases, // Also set this for compatibility
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        projectName: project?.name,
        featureName: feature?.name,
        // Force fresh timestamp to ensure it's treated as new data
        timestamp: new Date().toISOString(),
        generatedAt: new Date().toISOString(),
        generationId: Math.random().toString(36).substring(2, 15),
        aiModel: formData.ai_model || 'claude', // Store AI model for regeneration
        // Get screenshot information if available
        screenshots: files.length > 0 ? files.map(file => ({
          id: file.id,
          customName: file.customName,
          originalName: file.originalName,
          preview: file.isExisting && file.screenshotId ? 
            `http://localhost:3001/api/screenshots/${file.screenshotId}` : 
            file.preview,
          isExisting: file.isExisting,
          screenshotId: file.screenshotId
        })) : []
      }
      
      // Clear any existing cached test cases before setting new ones
      localStorage.removeItem("testCases")
      // Small delay to ensure removal is complete
      setTimeout(() => {
        localStorage.setItem("testCases", JSON.stringify(testCaseData))
        window.open('/results', '_blank')
      }, 100)
    }
  }

  const selectedIntent = TESTING_INTENTS.find(intent => intent.value === formData.testing_intent)
  const estimatedTests = getEstimatedTestCases()

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {scenario.name}
            </h1>
            <p className="text-sm text-gray-600">
              {project?.name} → {feature?.name}
            </p>
            {/* Save Status Indicator */}
            {hasAnyUnsavedChanges() ? (
              <div className="flex items-center gap-2 mt-2 text-xs">
                <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                <span className="text-orange-600 font-medium">
                  You have unsaved changes - Don't forget to save!
                </span>
              </div>
            ) : recentlySaved ? (
              <div className="flex items-center gap-2 mt-2 text-xs">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-green-600 font-medium">
                  All changes saved ✓
                </span>
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">
              {files.length} / 25 screenshots
            </span>
            {activeTab === 'screenshots' && (
              <button
                onClick={generateTestCases}
                disabled={files.length === 0 || isGenerating}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white px-4 py-2 rounded-lg font-medium transition-all disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                    Generating...
                  </div>
                ) : (
                  'Generate Test Cases'
                )}
              </button>
            )}
          </div>
        </div>
        
        {/* Success Message Banner */}
        {successMessage.isVisible && (
          <div className="mt-4 bg-green-100 border border-green-400 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-green-500 text-white rounded-full w-8 h-8 flex items-center justify-center">
                ✓
              </div>
              <div>
                <p className="text-green-800 font-medium">Success!</p>
                <p className="text-green-700 text-sm">{successMessage.message}</p>
              </div>
            </div>
            <button
              onClick={() => setSuccessMessage({ isVisible: false, message: '' })}
              className="text-green-600 hover:text-green-800 p-1"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 px-4">
          {[
            { key: 'configuration', label: 'Configuration', icon: '⚙️' },
            { key: 'screenshots', label: 'Screenshots', icon: '📸' },
            { key: 'context', label: 'Context & Requirements', icon: '📋' },
            { key: 'test-cases', label: 'Test Cases', icon: '🧪' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => handleTabSwitch(tab.key)}
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="flex items-center gap-2">
                <span>{tab.icon}</span>
                {tab.label}
                {/* Unsaved changes indicator */}
                {((tab.key === 'configuration' && unsavedChanges.configuration) ||
                  (tab.key === 'context' && unsavedChanges.context)) && (
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse ml-1" title="Unsaved changes"></div>
                )}
                {tab.key === 'test-cases' && testCases && (
                  <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">
                    {testCases.testCases?.length || testCases.allTestCases?.length || 0}
                  </span>
                )}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto h-0">
        {/* Configuration Tab */}
        {activeTab === 'configuration' && (
          <div className="p-6 max-w-4xl">
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  📝 Basic Information
                </h3>
                
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      Scenario Name *
                      {isFieldChanged('name') && (
                        <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" title="Unsaved changes"></span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., Login Form Validation, User Registration Flow"
                      maxLength={150}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      Brief Description
                      {isFieldChanged('description') && (
                        <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" title="Unsaved changes"></span>
                      )}
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                  <label className="block text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    Primary Testing Intent
                    {isFieldChanged('testing_intent') && (
                      <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" title="Unsaved changes"></span>
                    )}
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {TESTING_INTENTS.map((intent) => (
                      <label key={intent.value} className="cursor-pointer">
                        <input
                          type="radio"
                          name="testingIntent"
                          value={intent.value}
                          checked={formData.testing_intent === intent.value}
                          onChange={(e) => setFormData(prev => ({ ...prev, testing_intent: e.target.value }))}
                          className="sr-only"
                        />
                        <div className={`p-4 rounded-lg border-2 transition-all ${
                          formData.testing_intent === intent.value
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

                {/* AI Model Selection */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    🤖 AI Model Selection
                  </h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                      Choose AI Model for Test Generation
                      {isFieldChanged('ai_model') && (
                        <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" title="Unsaved changes"></span>
                      )}
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label className="cursor-pointer">
                        <input
                          type="radio"
                          name="aiModel"
                          value="gpt-4-vision"
                          checked={formData.ai_model === 'gpt-4-vision'}
                          onChange={(e) => setFormData(prev => ({ ...prev, ai_model: e.target.value }))}
                          className="sr-only"
                        />
                        <div className={`p-4 rounded-lg border-2 transition-all ${
                          formData.ai_model === 'gpt-4-vision'
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}>
                          <div className="flex items-center gap-3 mb-2">
                            <div className="text-2xl">🧠</div>
                            <div>
                              <div className="font-medium text-sm">GPT-4 Vision</div>
                              <div className="text-xs text-gray-500">OpenAI's advanced vision model</div>
                            </div>
                          </div>
                          <p className="text-xs text-gray-600">
                            Excellent at understanding complex UI layouts and generating comprehensive test scenarios
                          </p>
                        </div>
                      </label>

                      <label className="cursor-pointer">
                        <input
                          type="radio"
                          name="aiModel"
                          value="claude"
                          checked={formData.ai_model === 'claude'}
                          onChange={(e) => setFormData(prev => ({ ...prev, ai_model: e.target.value }))}
                          className="sr-only"
                        />
                        <div className={`p-4 rounded-lg border-2 transition-all ${
                          formData.ai_model === 'claude'
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}>
                          <div className="flex items-center gap-3 mb-2">
                            <div className="text-2xl">🎯</div>
                            <div>
                              <div className="font-medium text-sm">Claude</div>
                              <div className="text-xs text-gray-500">Anthropic's reasoning model</div>
                            </div>
                          </div>
                          <p className="text-xs text-gray-600">
                            Strong analytical capabilities for detailed test case generation and edge case identification
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Test Generation Settings */}
                <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                  <h4 className="font-medium text-gray-800">Test Generation Settings</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                        Coverage Level
                        {isFieldChanged('coverage_level') && (
                          <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" title="Unsaved changes"></span>
                        )}
                      </label>
                      <select
                        value={formData.coverage_level}
                        onChange={(e) => setFormData(prev => ({ ...prev, coverage_level: e.target.value }))}
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
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                        Test Types to Include
                        {isFieldChanged('test_types') && (
                          <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" title="Unsaved changes"></span>
                        )}
                      </label>
                      <div className="space-y-2">
                        {TEST_TYPE_OPTIONS.map(type => (
                          <label key={type.value} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={formData.test_types.includes(type.value)}
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
                      Focus: {selectedIntent?.label} • Coverage: {formData.coverage_level} • Types: {formData.test_types.length}
                    </p>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-4 border-t border-gray-200">
                <button
                  onClick={() => handleSaveConfiguration()}
                  disabled={isSaving}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Screenshots Tab */}
        {activeTab === 'screenshots' && (
          <div className="p-6">
            {files.length === 0 ? (
              /* Empty Upload State */
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`h-96 border-2 border-dashed rounded-xl flex items-center justify-center transition-colors ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <div className="text-center p-8">
                  <div className="text-6xl mb-6">📸</div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    Upload Screenshots
                  </h2>
                  <p className="text-gray-600 mb-6 max-w-md mx-auto">
                    Upload screenshots of your application for this scenario to generate comprehensive test cases.
                    Drag & drop images here or click to browse.
                  </p>
                  <label className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 cursor-pointer">
                    <span className="flex items-center gap-2">
                      <span>📁</span>
                      Choose Files
                    </span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleFileInput}
                      className="hidden"
                    />
                  </label>
                  <p className="text-sm text-gray-500 mt-4">
                    Supports: PNG, JPG, JPEG, GIF, WebP (Max: 25 files)
                  </p>
                </div>
              </div>
            ) : (
              /* Files Uploaded State */
              <div className="space-y-4">
                {/* Add More Files Area */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
                    isDragging
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <p className="text-gray-600">
                    Drop more screenshots here or{' '}
                    <label className="text-blue-600 hover:text-blue-700 cursor-pointer font-medium">
                      browse files
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleFileInput}
                        className="hidden"
                      />
                    </label>
                  </p>
                </div>

                {/* Simplified Flow Bar */}
                <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900 text-sm flex items-center gap-2">
                      <span>🔄</span>
                      Flow: {files.length} {files.length === 1 ? 'Step' : 'Steps'}
                    </h3>
                    <div className="text-xs text-gray-500">
                      💡 Hover on flow steps to see screenshot details
                    </div>
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto pb-2">
                    {files.map((file, index) => (
                      <div key={file.id} className="flex items-center flex-shrink-0">
                        <div 
                          className={`bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl px-4 py-2 text-sm font-bold cursor-help shadow-lg relative`}
                          title={file.customName}
                        >
                          {index + 1}
                        </div>
                        {index < files.length - 1 && (
                          <div className="mx-1 text-purple-400">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Screenshot Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {files.map((file, index) => (
                    <div 
                      key={file.id} 
                      className={`group relative bg-white border-2 rounded-xl shadow-sm transition-all duration-200 hover:shadow-md cursor-move ${
                        draggedIndex === index 
                          ? 'border-blue-500 bg-blue-50 opacity-75 transform rotate-1 scale-105' 
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                      draggable
                      onDragStart={(e) => handleImageDragStart(e, index)}
                      onDragOver={(e) => handleImageDragOver(e, index)}
                      onDrop={(e) => handleImageDrop(e, index)}
                      onDragEnd={handleImageDragEnd}
                    >
                      {/* Header with controls */}
                      <div className="p-3 pb-2">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold">
                              {index + 1}
                            </div>
                            <span className="text-xs text-gray-500 truncate max-w-24" title={file.originalName}>
                              {file.originalName}
                            </span>
                          </div>
                          <button
                            onClick={() => removeFile(index)}
                            className="bg-red-500 hover:bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm transition-colors shadow-sm"
                            title="Remove screenshot"
                          >
                            ×
                          </button>
                        </div>
                        
                        {/* Editable Name Field */}
                        <div className="mt-2">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            📝 Page Description:
                          </label>
                          <input
                            type="text"
                            value={file.customName}
                            onChange={(e) => updateFileName(index, e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                            placeholder="e.g., Login Page, Dashboard, User Profile..."
                          />
                        </div>
                      </div>

                      {/* Image container */}
                      <div className="relative mx-3 mb-3">
                        <div 
                          className="relative rounded-lg overflow-hidden border border-gray-100 cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => setMaximizedScreenshot({ isOpen: true, file, index })}
                          title="Click to maximize (ESC to close)"
                        >
                          {file.isExisting && file.screenshotId ? (
                            <SecureImage
                              screenshotId={file.screenshotId.toString()}
                              alt={`Screenshot ${index + 1}`}
                              className="w-full h-40 object-cover transition-transform duration-200 group-hover:scale-105"
                            />
                          ) : (
                            <img
                              src={file.preview}
                              alt={`Screenshot ${index + 1}`}
                              className="w-full h-40 object-cover transition-transform duration-200 group-hover:scale-105"
                            />
                          )}
                          {/* Maximize icon overlay */}
                          <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                            </svg>
                          </div>
                        </div>
                      </div>

                      {/* Footer with drag handle and reorder buttons */}
                      <div className="flex items-center justify-between px-3 pb-3">
                        <div className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
                          </svg>
                          <span className="text-xs font-medium">Drag anywhere to reorder</span>
                        </div>
                        
                        <div className="flex gap-1">
                          {index > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                moveFile(index, index - 1);
                              }}
                              className="bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full w-7 h-7 flex items-center justify-center text-sm transition-colors"
                              title="Move up"
                            >
                              ↑
                            </button>
                          )}
                          {index < files.length - 1 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                moveFile(index, index + 1);
                              }}
                              className="bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full w-7 h-7 flex items-center justify-center text-sm transition-colors"
                              title="Move down"
                            >
                              ↓
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Context & Requirements Tab */}
        {activeTab === 'context' && (
          <div className="p-6 max-w-4xl">
            <div className="space-y-6">
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
              <div className="min-h-[200px]">
                {activeContextTab === 'user_story' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      User Story (Optional)
                      {isFieldChanged('user_story') && (
                        <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" title="Unsaved changes"></span>
                      )}
                    </label>
                    <textarea
                      value={formData.user_story}
                      onChange={(e) => setFormData(prev => ({ ...prev, user_story: e.target.value }))}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="As a [user type], I want [goal] so that [benefit]..."
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Paste your Jira user story or requirement description here
                    </p>
                    <div className="flex justify-end mt-4">
                      <button
                        onClick={handleSaveUserStory}
                        disabled={isSaving}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                      >
                        {isSaving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                )}

                {activeContextTab === 'acceptance_criteria' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      Acceptance Criteria (Optional)
                      {isFieldChanged('acceptance_criteria') && (
                        <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" title="Unsaved changes"></span>
                      )}
                    </label>
                    <textarea
                      value={formData.acceptance_criteria}
                      onChange={(e) => setFormData(prev => ({ ...prev, acceptance_criteria: e.target.value }))}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Given [context], When [action], Then [expected result]..."
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Define the conditions that must be met for this scenario to be considered complete
                    </p>
                    <div className="flex justify-end mt-4">
                      <button
                        onClick={handleSaveAcceptanceCriteria}
                        disabled={isSaving}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                      >
                        {isSaving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                )}

                {activeContextTab === 'business_rules' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      Business Rules (Optional)
                      {isFieldChanged('business_rules') && (
                        <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" title="Unsaved changes"></span>
                      )}
                    </label>
                    <textarea
                      value={formData.business_rules}
                      onChange={(e) => setFormData(prev => ({ ...prev, business_rules: e.target.value }))}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Business logic, validations, calculations, or constraints that apply..."
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Document business logic that affects testing scenarios
                    </p>
                    <div className="flex justify-end mt-4">
                      <button
                        onClick={handleSaveBusinessRules}
                        disabled={isSaving}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                      >
                        {isSaving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                )}

                {activeContextTab === 'edge_cases' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      Edge Cases & Special Scenarios (Optional)
                      {isFieldChanged('edge_cases') && (
                        <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" title="Unsaved changes"></span>
                      )}
                    </label>
                    <textarea
                      value={formData.edge_cases}
                      onChange={(e) => setFormData(prev => ({ ...prev, edge_cases: e.target.value }))}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Unusual conditions, boundary cases, error scenarios to consider..."
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Specify edge cases and unusual scenarios that should be tested
                    </p>
                    <div className="flex justify-end mt-4">
                      <button
                        onClick={handleSaveEdgeCases}
                        disabled={isSaving}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                      >
                        {isSaving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                )}

                {activeContextTab === 'environment' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      Test Environment Details (Optional)
                      {isFieldChanged('test_environment') && (
                        <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" title="Unsaved changes"></span>
                      )}
                    </label>
                    <textarea
                      value={formData.test_environment}
                      onChange={(e) => setFormData(prev => ({ ...prev, test_environment: e.target.value }))}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Browser requirements, test data setup, environment configurations..."
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Specify environment setup requirements and constraints
                    </p>
                    <div className="flex justify-end mt-4">
                      <button
                        onClick={handleSaveTestEnvironment}
                        disabled={isSaving}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                      >
                        {isSaving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Test Cases Tab */}
        {activeTab === 'test-cases' && (
          <div className="p-6">
            {testCases ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-800">
                    Test Cases ({testCases.testCases?.length || testCases.allTestCases?.length || 0})
                  </h3>
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-600">
                      Generated: {testCases.timestamp ? new Date(testCases.timestamp).toLocaleDateString('en-US', {
                        month: '2-digit',
                        day: '2-digit', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                      }) : 'Unknown'}
                    </div>
                    <button
                      onClick={navigateToResults}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm flex items-center gap-2"
                    >
                      <span>📋</span>
                      View All Tests
                    </button>
                  </div>
                </div>
                
                {(() => {
                  const actualTestCases = testCases.testCases || testCases.allTestCases || []
                  return actualTestCases.length > 0 ? (
                    <div className="space-y-3">
                      {actualTestCases.map((testCase: any, index: number) => {
                      const isExpanded = expandedTestCases.has(index)
                      
                      return (
                        <div key={index} className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-sm transition-shadow">
                          {/* Collapsible Header */}
                          <div 
                            className="p-4 cursor-pointer hover:bg-gray-50 transition-colors flex items-center justify-between"
                            onClick={() => toggleTestCase(index)}
                          >
                            <div className="flex items-center gap-3">
                              <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                                {index + 1}
                              </div>
                              <h4 className="font-medium text-gray-900">
                                {testCase.title || testCase.name || `Test Case ${index + 1}`}
                              </h4>
                              {testCase.priority && (
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  testCase.priority === 'High' 
                                    ? 'bg-red-100 text-red-800' 
                                    : testCase.priority === 'Medium'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-green-100 text-green-800'
                                }`}>
                                  {testCase.priority}
                                </span>
                              )}
                              {testCase.type && (
                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                  {testCase.type}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">Click to {isExpanded ? 'collapse' : 'expand'}</span>
                              <div className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </div>
                          </div>

                          {/* Collapsible Content */}
                          {isExpanded && (
                            <div className="border-t border-gray-100 p-4 bg-gray-50">
                              {testCase.description && (
                                <div className="mb-4">
                                  <p className="text-gray-700 text-sm">{testCase.description}</p>
                                </div>
                              )}
                              
                              {/* Enhanced Test Case Layout */}
                              <div className="space-y-6">
                                {/* Test Steps and Expected Results - Two Column Layout */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                  {/* Left Column - Test Steps */}
                                  <div>
                                  {/* Test Steps */}
                                  {(() => {
                                    const steps = testCase.steps || testCase.testSteps || testCase.actions
                                    if (!steps) return null
                                    
                                    let stepsArray = []
                                    if (Array.isArray(steps)) {
                                      stepsArray = steps
                                    } else if (typeof steps === 'string') {
                                      stepsArray = steps.includes('\n') ? steps.split('\n').filter(s => s.trim()) : [steps]
                                    } else if (typeof steps === 'object') {
                                      stepsArray = Object.values(steps).filter(s => s && typeof s === 'string')
                                    }
                                    
                                    if (stepsArray.length === 0) return null
                                    
                                    return (
                                      <div>
                                        <h5 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                                          <span>📋</span>
                                          Test Steps
                                        </h5>
                                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                                          <div className="space-y-2 text-sm text-gray-700">
                                            {stepsArray.map((step: string, stepIndex: number) => {
                                              const trimmedStep = String(step).trim()
                                              
                                              // Check if this is a sub-item (starts with dash or bullet)
                                              const isSubItem = trimmedStep.startsWith('-') || trimmedStep.startsWith('•')
                                              
                                              if (isSubItem) {
                                                // Sub-item: just show with bullet point, no number
                                                return (
                                                  <div key={stepIndex} className="flex gap-3 ml-8">
                                                    <span className="text-gray-400 flex-shrink-0 mt-1">•</span>
                                                    <span>{trimmedStep.replace(/^[-•]\s*/, '')}</span>
                                                  </div>
                                                )
                                              } else {
                                                // Main step: simple format like in image
                                                // Extract step number if it exists, otherwise use stepIndex
                                                const stepMatch = trimmedStep.match(/^(\d+)\.(.+)/)
                                                const stepNumber = stepMatch ? stepMatch[1] : (stepIndex + 1).toString()
                                                const stepText = stepMatch ? stepMatch[2].trim() : trimmedStep
                                                
                                                return (
                                                  <div key={stepIndex} className="flex gap-3">
                                                    <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                                                      {stepNumber}
                                                    </span>
                                                    <span>{stepText}</span>
                                                  </div>
                                                )
                                              }
                                            })}
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  })()}
                                  </div>

                                  {/* Right Column - Expected Results */}
                                  <div>
                                  {/* Expected Results */}
                                  {(() => {
                                    const expected = testCase.expectedResult || testCase.expected || testCase.expectedOutcome || testCase.expectedResults
                                    if (!expected) return null
                                    
                                    let expectedItems = []
                                    if (Array.isArray(expected)) {
                                      expectedItems = expected
                                    } else if (typeof expected === 'object') {
                                      expectedItems = Object.entries(expected).map(([key, value]) => ({ category: key, result: value }))
                                    } else if (typeof expected === 'string') {
                                      // Split by line breaks or treat as single item
                                      if (expected.includes('\n')) {
                                        expectedItems = expected.split('\n').filter(item => item.trim()).map((item, index) => ({
                                          category: `Result ${index + 1}`,
                                          result: item.trim()
                                        }))
                                      } else {
                                        expectedItems = [{ category: 'Expected Result', result: expected }]
                                      }
                                    }
                                    
                                    return (
                                      <div>
                                        <h5 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                                          <span>✅</span>
                                          Expected Results
                                        </h5>
                                        <div className="bg-white rounded-lg p-4 border border-gray-200">
                                          <div className="space-y-2 text-sm text-gray-700">
                                            {expectedItems.map((item: any, resultIndex: number) => (
                                              <div key={resultIndex} className="flex gap-3">
                                                <span className="bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                                                  {resultIndex + 1}
                                                </span>
                                                <span>
                                                  {(() => {
                                                    let text = typeof item.result === 'string' ? item.result : 
                                                              typeof item === 'string' ? item :
                                                              typeof item.result === 'object' ? JSON.stringify(item.result, null, 2) :
                                                              String(item.result || item)
                                                    // Remove bullet points and clean up text
                                                    return text.replace(/^[•\-\*]\s*/, '').trim()
                                                  })()}
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  })()}
                                  </div>
                                </div>

                                {/* Full Width Test Data Section */}
                                {(() => {
                                  const testData = testCase.testData || testCase.data || testCase.inputData || testCase.inputs
                                  if (!testData) return null
                                  
                                  let dataToShow = []
                                  if (Array.isArray(testData)) {
                                    dataToShow = testData
                                  } else if (typeof testData === 'object') {
                                    dataToShow = Object.entries(testData).map(([key, value]) => ({ field: key, value }))
                                  } else if (typeof testData === 'string') {
                                    // Try to parse as JSON or treat as plain text
                                    try {
                                      const parsed = JSON.parse(testData)
                                      if (typeof parsed === 'object') {
                                        dataToShow = Object.entries(parsed).map(([key, value]) => ({ field: key, value }))
                                      } else {
                                        dataToShow = [{ field: 'Data', value: testData }]
                                      }
                                    } catch {
                                      dataToShow = [{ field: 'Data', value: testData }]
                                    }
                                  }
                                  
                                  if (dataToShow.length === 0) return null
                                  
                                  return (
                                    <div className="w-full">
                                      <h5 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                                        <span>📊</span>
                                        Test Data
                                      </h5>
                                      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                        <table className="w-full text-sm">
                                          <thead className="bg-gray-50">
                                            <tr>
                                              <th className="text-left p-3 font-medium text-gray-800">Field</th>
                                              <th className="text-left p-3 font-medium text-gray-800">Value</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {dataToShow.map((item: any, dataIndex: number) => (
                                              <tr key={dataIndex} className={dataIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                <td className="p-3 font-medium text-gray-700">
                                                  {item.field || item.name || `Data ${dataIndex + 1}`}
                                                </td>
                                                <td className="p-3 text-gray-600">
                                                  {typeof item.value === 'string' ? item.value : 
                                                   typeof item.value === 'object' ? JSON.stringify(item.value) : 
                                                   String(item.value || item)}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  )
                                })()}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <div className="text-6xl mb-4">📝</div>
                      <h3 className="text-xl font-medium text-gray-900 mb-2">No Test Cases Generated</h3>
                      <p className="text-gray-600">Upload screenshots and generate test cases to see them here.</p>
                    </div>
                  )
                })()}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🧪</div>
                <h3 className="text-xl font-medium text-gray-900 mb-2">No Test Cases Yet</h3>
                <p className="text-gray-600 mb-6">
                  Upload screenshots in the Screenshots tab and click "Generate Test Cases" to create comprehensive test cases.
                </p>
                <button
                  onClick={() => setActiveTab('screenshots')}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  Go to Screenshots
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Maximized Screenshot Modal */}
      {maximizedScreenshot.isOpen && maximizedScreenshot.file && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4">
          {/* Close button */}
          <button
            onClick={() => setMaximizedScreenshot({ isOpen: false, file: null, index: null })}
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors z-10"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Screenshot info */}
          <div className="absolute top-4 left-4 text-white z-10">
            <div className="bg-black bg-opacity-50 rounded px-3 py-2">
              <p className="font-medium">Screenshot {maximizedScreenshot.index !== null ? maximizedScreenshot.index + 1 : ''}</p>
              <p className="text-sm opacity-75">{maximizedScreenshot.file.customName}</p>
            </div>
          </div>

          {/* Maximized image */}
          <div className="max-w-full max-h-full flex items-center justify-center">
            {maximizedScreenshot.file.isExisting && maximizedScreenshot.file.screenshotId ? (
              <SecureImage
                screenshotId={maximizedScreenshot.file.screenshotId.toString()}
                alt={`Maximized Screenshot ${maximizedScreenshot.index !== null ? maximizedScreenshot.index + 1 : ''}`}
                className="max-w-full max-h-full object-contain shadow-2xl"
              />
            ) : (
              <img
                src={maximizedScreenshot.file.preview}
                alt={`Maximized Screenshot ${maximizedScreenshot.index !== null ? maximizedScreenshot.index + 1 : ''}`}
                className="max-w-full max-h-full object-contain shadow-2xl"
              />
            )}
          </div>

          {/* Help text at bottom */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-center">
            <div className="bg-black bg-opacity-50 rounded px-4 py-2">
              <p className="text-sm">Press <kbd className="bg-gray-700 px-2 py-1 rounded text-xs">ESC</kbd> to close or click outside the image</p>
            </div>
          </div>

          {/* Click outside to close */}
          <div 
            className="absolute inset-0 -z-10" 
            onClick={() => setMaximizedScreenshot({ isOpen: false, file: null, index: null })}
          />
        </div>
      )}

      {/* Unsaved Changes Warning Modal */}
      {showUnsavedWarning && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-5 rounded-t-xl">
              <h2 className="text-xl font-bold text-white">
                Unsaved Changes
              </h2>
            </div>

            {/* Content */}
            <div className="p-6">
              <p className="text-gray-600 text-center mb-6">
                You have unsaved changes. What would you like to do?
              </p>

              {/* Actions */}
              <div className="space-y-3">
                <button
                  onClick={handleSaveAndSwitch}
                  disabled={isSaving}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white px-4 py-3 rounded-lg font-semibold transition-all disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                      <span>Saving...</span>
                    </div>
                  ) : (
                    'Save & Continue'
                  )}
                </button>
                
                <button
                  onClick={handleDiscardAndSwitch}
                  className="w-full bg-gray-500 hover:bg-gray-600 text-white px-4 py-3 rounded-lg font-semibold transition-colors"
                >
                  Discard
                </button>
                
                <button
                  onClick={handleCancelSwitch}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-3 rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      <Toast
        message={toast.message}
        type={toast.type}
        isOpen={toast.isOpen}
        onClose={() => setToast(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  )
}
