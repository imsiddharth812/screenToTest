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
  { value: 'edge_cases', label: 'Edge Cases', description: 'Boundary values and unusual scenarios' },
  { value: 'security', label: 'Security Testing', description: 'Input sanitization and security validations' }
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
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  
  // Configuration state
  const [formData, setFormData] = useState({
    name: scenario.name || '',
    description: scenario.description || '',
    testing_intent: scenario.testing_intent || 'comprehensive',
    coverage_level: scenario.coverage_level || 'comprehensive',
    test_types: scenario.test_types || ['positive', 'negative', 'edge_cases'],
    user_story: scenario.user_story || '',
    acceptance_criteria: scenario.acceptance_criteria || '',
    business_rules: scenario.business_rules || '',
    edge_cases: scenario.edge_cases || '',
    test_environment: scenario.test_environment || ''
  })

  // Remove auto-save functionality - only save when user clicks Save button

  // Load existing screenshots and test cases when scenario changes
  useEffect(() => {
    loadExistingScreenshots()
    loadExistingTestCases()
  }, [scenario.id])

  // Sync formData with scenario props when scenario changes
  useEffect(() => {
    setFormData({
      name: scenario.name || '',
      description: scenario.description || '',
      testing_intent: scenario.testing_intent || 'comprehensive',
      coverage_level: scenario.coverage_level || 'comprehensive',
      test_types: scenario.test_types || ['positive', 'negative', 'edge_cases'],
      user_story: scenario.user_story || '',
      acceptance_criteria: scenario.acceptance_criteria || '',
      business_rules: scenario.business_rules || '',
      edge_cases: scenario.edge_cases || '',
      test_environment: scenario.test_environment || ''
    })
    setLastSaved(null) // Clear save status when switching scenarios
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
        console.log('Loaded test cases:', data) // Debug log
        if (data.testCases && data.testCases.length > 0) {
          // Get the latest test case set (first item since they're ordered by updated_at DESC)
          const latestTestCase = data.testCases[0]
          console.log('Latest test case data:', latestTestCase)
          console.log('Type of testCases:', typeof latestTestCase.testCases)
          
          // Extract test cases - they might be in different properties
          let actualTestCases = []
          
          if (Array.isArray(latestTestCase.testCases)) {
            // Direct array
            actualTestCases = latestTestCase.testCases
            console.log('Found direct array of test cases')
          } else if (latestTestCase.testCases && typeof latestTestCase.testCases === 'object') {
            // Object with nested properties
            if (latestTestCase.testCases.allTestCases) {
              actualTestCases = latestTestCase.testCases.allTestCases
              console.log('Found nested allTestCases')
            } else if (latestTestCase.testCases.testCases) {
              actualTestCases = latestTestCase.testCases.testCases
              console.log('Found nested testCases')
            } else {
              // Maybe it's an object that itself is the test cases array structure
              actualTestCases = [latestTestCase.testCases]
              console.log('Treating object as single test case')
            }
          } else if (typeof latestTestCase.testCases === 'string') {
            // JSON string - parse it
            console.log('Parsing JSON string:', latestTestCase.testCases.substring(0, 100) + '...')
            try {
              const parsed = JSON.parse(latestTestCase.testCases)
              console.log('Parsed JSON:', parsed)
              
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
          
          console.log('Final extracted test cases:', actualTestCases)
          console.log('Number of test cases found:', actualTestCases.length)
          
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
          
          console.log('Setting test case state with:', testCaseData)
          setTestCases(testCaseData)
        } else {
          console.log('No test cases found in response')
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
        setLastSaved(new Date())
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

  const handleFiles = useCallback(async (newFiles: File[]) => {
    const imageFiles = newFiles.filter(file => file.type.startsWith('image/'))
    
    if (files.length + imageFiles.length > 25) {
      showToast('Maximum 25 screenshots allowed', 'error')
      return
    }

    const newUploadedFiles = imageFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
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
        console.log('Screenshot order saved successfully')
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
        console.log(`Updating screenshot ${file.screenshotId} name to: "${newName}"`)
        
        const response = await fetch(`http://localhost:3001/api/screenshots/${file.screenshotId}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ custom_name: newName })
        })
        
        if (response.ok) {
          console.log('Screenshot name updated successfully')
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
        setTestCases(result)
        setActiveTab('test-cases')
        showToast('Test cases generated successfully!', 'success')
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
    if (testCases && testCases.testCases) {
      // Format data for Results page - it expects allTestCases, not testCases
      const testCaseData = {
        ...testCases,
        allTestCases: testCases.testCases, // Results page expects this property name
        scenarioId: scenario.id,
        scenarioName: scenario.name,
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
      
      console.log('Sending to Results page:', testCaseData)
      localStorage.setItem("testCases", JSON.stringify(testCaseData))
      window.open('/results', '_blank')
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
              onClick={() => setActiveTab(tab.key)}
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="flex items-center gap-2">
                <span>{tab.icon}</span>
                {tab.label}
                {tab.key === 'test-cases' && testCases && (
                  <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">
                    {testCases.testCases?.length || 0}
                  </span>
                )}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Scenario Name *
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Brief Description
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

                {/* Test Generation Settings */}
                <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                  <h4 className="font-medium text-gray-800">Test Generation Settings</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Coverage Level
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Test Types to Include
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
                      💡 Drag screenshots to reorder • Click to edit names
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
                        <div className="relative rounded-lg overflow-hidden border border-gray-100">
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      User Story (Optional)
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Acceptance Criteria (Optional)
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Business Rules (Optional)
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Edge Cases & Special Scenarios (Optional)
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Test Environment Details (Optional)
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
                    Test Cases ({testCases.testCases?.length || 0})
                  </h3>
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-600">
                      Generated: {new Date(testCases.timestamp).toLocaleString()}
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
                
                {testCases.testCases && testCases.testCases.length > 0 ? (
                  <div className="space-y-3">
                    {testCases.testCases.map((testCase: any, index: number) => {
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
                              
                              <div className="space-y-4">
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
                                        Test Steps:
                                      </h5>
                                      <div className="bg-white rounded-lg p-3 border">
                                        <div className="space-y-2 text-sm text-gray-700">
                                          {stepsArray.map((step: string, stepIndex: number) => {
                                            const trimmedStep = String(step).trim()
                                            
                                            // Check if this is a main step (starts with number) or a sub-item (starts with dash)
                                            const isMainStep = /^\d+\./.test(trimmedStep) || (!trimmedStep.startsWith('-') && !trimmedStep.startsWith('•'))
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
                                              // Main step: show with blue number
                                              // Extract step number if it exists, otherwise use stepIndex
                                              const stepMatch = trimmedStep.match(/^(\d+)\.(.+)/)
                                              const stepNumber = stepMatch ? stepMatch[1] : (stepIndex + 1).toString()
                                              const stepText = stepMatch ? stepMatch[2].trim() : trimmedStep
                                              
                                              return (
                                                <div key={stepIndex} className="flex gap-3">
                                                  <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">
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
                                
                                {/* Expected Result */}
                                {(() => {
                                  const expected = testCase.expectedResult || testCase.expected || testCase.expectedOutcome
                                  if (!expected) return null
                                  
                                  const expectedText = typeof expected === 'string' ? expected : 
                                                     typeof expected === 'object' ? JSON.stringify(expected, null, 2) :
                                                     String(expected)
                                  
                                  return (
                                    <div>
                                      <h5 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                                        <span>✅</span>
                                        Expected Result:
                                      </h5>
                                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                        <p className="text-sm text-green-800 whitespace-pre-wrap">
                                          {expectedText}
                                        </p>
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
                )}
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