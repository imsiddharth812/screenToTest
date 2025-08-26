'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from './components/AuthContext'
import AuthModal from './components/AuthModal'
import ProjectModal from './components/ProjectModal'
import FeatureModal from './components/FeatureModal'
import ScenarioModal from './components/ScenarioModal'
import ConfirmModal from './components/ConfirmModal'
import SecureImage from './components/SecureImage'
import {
  projectsApi,
  featuresApi,
  scenariosApi,
  type Project,
  type Feature,
  type Scenario,
} from './services'

interface UploadedFile {
  file: File | null
  preview: string
  id: string
  originalName: string
  customName: string
  isExisting?: boolean
  screenshotId?: number
}

function DashboardView({ user, logout }: { user: any, logout: () => void }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [features, setFeatures] = useState<Feature[]>([])
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [featuresPerProject, setFeaturesPerProject] = useState<{[projectId: number]: Feature[]}>({}) 
  const [scenariosPerFeature, setScenariosPerFeature] = useState<{[featureId: number]: Scenario[]}>({}) 
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null)
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Tree view states
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set())
  const [expandedFeatures, setExpandedFeatures] = useState<Set<number>>(new Set())

  // Modal states
  const [projectModal, setProjectModal] = useState<{isOpen: boolean, mode: 'create' | 'edit', project?: Project}>({isOpen: false, mode: 'create'})
  const [featureModal, setFeatureModal] = useState<{isOpen: boolean, mode: 'create' | 'edit', feature?: Feature}>({isOpen: false, mode: 'create'})
  const [scenarioModal, setScenarioModal] = useState<{isOpen: boolean, mode: 'create' | 'edit', scenario?: Scenario}>({isOpen: false, mode: 'create'})
  const [deleteModal, setDeleteModal] = useState<{isOpen: boolean, type: 'project' | 'feature' | 'scenario', item?: Project | Feature | Scenario}>({isOpen: false, type: 'project'})

  // Upload state
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [maximizedImage, setMaximizedImage] = useState<string | null>(null)
  const [maximizedImageName, setMaximizedImageName] = useState<string>('')
  const [isHelpPanelOpen, setIsHelpPanelOpen] = useState(false)
  const [showHelpHint, setShowHelpHint] = useState(false)

  // Unified analysis approach - no modal needed
  
  // Test case history state
  const [scenarioTestCases, setScenarioTestCases] = useState<{[scenarioId: number]: any[]}>({})
  const [expandedScenarios, setExpandedScenarios] = useState<Set<number>>(new Set())


  // Load data on component mount
  useEffect(() => {
    loadProjects()
  }, [])

  // Helper function to check if text is truncated and setup conditional tooltip
  const handleTooltipCheck = useCallback((element: HTMLElement, text: string) => {
    // Use setTimeout to ensure element is fully rendered
    setTimeout(() => {
      // Simple approach: temporarily remove truncate class to measure natural width
      const originalClasses = element.className
      const originalOverflow = element.style.overflow
      const originalTextOverflow = element.style.textOverflow
      const originalWhiteSpace = element.style.whiteSpace
      
      // Remove truncation temporarily
      element.className = originalClasses.replace('truncate', '')
      element.style.overflow = 'visible'
      element.style.textOverflow = 'clip'
      element.style.whiteSpace = 'nowrap'
      
      // Force reflow and measure natural width
      element.offsetHeight // Force reflow
      const naturalWidth = element.scrollWidth
      
      // Restore original styles
      element.className = originalClasses
      element.style.overflow = originalOverflow
      element.style.textOverflow = originalTextOverflow
      element.style.whiteSpace = originalWhiteSpace
      element.offsetHeight // Force reflow again
      
      // Get the actual rendered width when truncated
      const actualTextWidth = element.getBoundingClientRect().width
      
      // If naturalWidth > actualTextWidth, then text is truncated
      const isOverflowing = naturalWidth > (actualTextWidth + 5) // Larger tolerance
      
      // Only show tooltip if text is actually truncated
      const shouldShowTooltip = isOverflowing
      
      // Clean up any existing event listeners
      element.removeAttribute('data-tooltip-setup')
      
      if (shouldShowTooltip) {
        element.setAttribute('data-show-tooltip', 'true')
        element.setAttribute('data-tooltip-text', text)
        
        // Only add event listener if not already added
        if (!element.hasAttribute('data-tooltip-setup')) {
          const handleMouseEnter = (e: MouseEvent) => {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
            const target = e.currentTarget as HTMLElement
            target.style.setProperty('--tooltip-x', `${rect.left + rect.width / 2}px`)
            target.style.setProperty('--tooltip-y', `${rect.bottom + 8}px`)
            target.style.setProperty('--tooltip-y-arrow', `${rect.bottom + 4}px`)
          }
          
          element.addEventListener('mouseenter', handleMouseEnter)
          element.setAttribute('data-tooltip-setup', 'true')
        }
      } else {
        element.setAttribute('data-show-tooltip', 'false')
        element.removeAttribute('data-tooltip-text')
      }
    }, 200) // Increased timeout to ensure rendering is complete
  }, [])

  // Handle keyboard events for maximized image and help panel
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isHelpPanelOpen) {
          setIsHelpPanelOpen(false)
        } else if (maximizedImage) {
          setMaximizedImage(null)
          setMaximizedImageName('')
        }
      }
    }

    if (maximizedImage || isHelpPanelOpen) {
      document.addEventListener('keydown', handleKeyDown)
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
    }
  }, [maximizedImage, isHelpPanelOpen])

  // Show help hint when files are first uploaded
  useEffect(() => {
    if (files.length === 1 && !showHelpHint) {
      // Show hint after a short delay when first screenshot is uploaded
      const timer = setTimeout(() => {
        setShowHelpHint(true)
      }, 1000)
      
      return () => clearTimeout(timer)
    }
  }, [files.length, showHelpHint])

  // Auto-hide help hint after 5 seconds
  useEffect(() => {
    if (showHelpHint) {
      const timer = setTimeout(() => {
        setShowHelpHint(false)
      }, 5000)
      
      return () => clearTimeout(timer)
    }
  }, [showHelpHint])

  const loadProjects = async () => {
    try {
      setLoading(true)
      setError('')
      const result = await projectsApi.getAll()
      setProjects(result.projects)
    } catch (error) {
      setError('Failed to load projects')
      console.error('Error loading projects:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadFeatures = async (projectId: number) => {
    try {
      const result = await featuresApi.getByProject(projectId)
      setFeaturesPerProject(prev => ({
        ...prev,
        [projectId]: result.features
      }))
      // Also keep the main features state for backward compatibility
      setFeatures(result.features)
    } catch (error) {
      setError('Failed to load features')
      console.error('Error loading features:', error)
    }
  }

  const loadScenarios = async (featureId: number) => {
    try {
      const result = await scenariosApi.getByFeature(featureId)
      setScenariosPerFeature(prev => ({
        ...prev,
        [featureId]: result.scenarios
      }))
      // Also keep the main scenarios state for backward compatibility
      setScenarios(result.scenarios)
    } catch (error) {
      setError('Failed to load scenarios')
      console.error('Error loading scenarios:', error)
    }
  }

  // Tree expansion handlers
  const toggleProjectExpansion = (projectId: number) => {
    const newExpanded = new Set(expandedProjects)
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId)
      // Clear features for this project when collapsed
      setFeaturesPerProject(prev => {
        const updated = { ...prev }
        delete updated[projectId]
        return updated
      })
      if (selectedProject?.id === projectId) {
        setSelectedProject(null)
        setSelectedFeature(null)
        setSelectedScenario(null)
        setFeatures([])
        setScenarios([])
      }
    } else {
      newExpanded.add(projectId)
    }
    setExpandedProjects(newExpanded)
  }

  const toggleFeatureExpansion = async (featureId: number) => {
    const newExpanded = new Set(expandedFeatures)
    if (newExpanded.has(featureId)) {
      newExpanded.delete(featureId)
      // Clear scenarios for this feature when collapsed
      setScenariosPerFeature(prev => {
        const updated = { ...prev }
        delete updated[featureId]
        return updated
      })
      if (selectedFeature?.id === featureId) {
        setSelectedFeature(null)
        setSelectedScenario(null)
        setScenarios([])
      }
    } else {
      newExpanded.add(featureId)
      // Load scenarios when feature is expanded
      await loadScenarios(featureId)
    }
    setExpandedFeatures(newExpanded)
  }

  // Selection handlers
  const handleProjectSelect = async (project: Project) => {
    setSelectedProject(project)
    setSelectedFeature(null)
    setSelectedScenario(null)
    setScenarios([])
    
    // Auto-expand project when selected
    const newExpanded = new Set(expandedProjects)
    newExpanded.add(project.id)
    setExpandedProjects(newExpanded)
    
    await loadFeatures(project.id)
  }

  const handleFeatureSelect = async (feature: Feature) => {
    setSelectedFeature(feature)
    setSelectedScenario(null)
    
    // Auto-expand feature when selected
    const newExpanded = new Set(expandedFeatures)
    newExpanded.add(feature.id)
    setExpandedFeatures(newExpanded)
    
    await loadScenarios(feature.id)
  }

  const handleScenarioSelect = async (scenario: Scenario) => {
    setSelectedScenario(scenario)
    
    // Load existing screenshots for this scenario
    try {
      const token = localStorage.getItem('authToken')
      console.log(`Fetching screenshots for scenario ${scenario.id}`)
      const response = await fetch(`http://localhost:3001/api/screenshots/${scenario.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      console.log('Response status:', response.status)
      
      if (response.ok) {
        const data = await response.json()
        console.log('Loaded screenshots from database:', data.screenshots)
        // Convert database screenshots to UploadedFile format for display
        const existingFiles: UploadedFile[] = data.screenshots.map((screenshot: any) => {
          // Use secure API endpoint instead of direct file access
          const previewUrl = `http://localhost:3001/api/screenshots/${screenshot.id}`
          console.log(`Screenshot ${screenshot.id}: ${screenshot.original_name} -> ${previewUrl}`)
          return {
            id: screenshot.id.toString(),
            file: null, // Not needed for display
            preview: previewUrl,
            originalName: screenshot.original_name,
            customName: screenshot.custom_name || screenshot.original_name.replace(/\.[^/.]+$/, ''),
            isExisting: true, // Flag to identify existing screenshots
            screenshotId: screenshot.id // Store database ID
          }
        })
        
        console.log('Converted to files:', existingFiles)
        setFiles(existingFiles)
      } else {
        // Even if API call fails, keep the scenario selected and just clear files
        console.log('Failed to fetch screenshots, status:', response.status)
        const errorText = await response.text()
        console.log('Error response:', errorText)
        setFiles([])
      }
    } catch (error) {
      console.error('Error loading existing screenshots:', error)
      // Even if API call fails, keep the scenario selected and just clear files
      setFiles([])
    }
  }

  // Modal handlers
  const openProjectModal = (mode: 'create' | 'edit', project?: Project) => {
    setProjectModal({ isOpen: true, mode, project })
  }

  const closeProjectModal = () => {
    setProjectModal({ isOpen: false, mode: 'create' })
  }

  const openFeatureModal = (mode: 'create' | 'edit', feature?: Feature) => {
    setFeatureModal({ isOpen: true, mode, feature })
  }

  const closeFeatureModal = () => {
    setFeatureModal({ isOpen: false, mode: 'create' })
  }

  const openScenarioModal = (mode: 'create' | 'edit', scenario?: Scenario) => {
    setScenarioModal({ isOpen: true, mode, scenario })
  }

  const closeScenarioModal = () => {
    setScenarioModal({ isOpen: false, mode: 'create' })
  }

  const openDeleteModal = (type: 'project' | 'feature' | 'scenario', item: Project | Feature | Scenario) => {
    setDeleteModal({ isOpen: true, type, item })
  }

  const closeDeleteModal = () => {
    setDeleteModal({ isOpen: false, type: 'project' })
  }

  // CRUD success handlers
  const handleProjectSuccess = (project: Project) => {
    if (projectModal.mode === 'create') {
      setProjects([...projects, project])
    } else {
      setProjects(projects.map(p => p.id === project.id ? project : p))
      if (selectedProject?.id === project.id) {
        setSelectedProject(project)
      }
    }
  }

  const handleFeatureSuccess = (feature: Feature) => {
    if (featureModal.mode === 'create') {
      // Add new feature to both features state and featuresPerProject state
      setFeatures([...features, feature])
      if (selectedProject) {
        setFeaturesPerProject(prev => ({
          ...prev,
          [selectedProject.id]: [...(prev[selectedProject.id] || []), feature]
        }))
      }
    } else {
      // Update existing feature in both states
      setFeatures(features.map(f => f.id === feature.id ? feature : f))
      setFeaturesPerProject(prev => {
        const updated = { ...prev }
        Object.keys(updated).forEach(projectId => {
          updated[Number(projectId)] = updated[Number(projectId)].map(f => f.id === feature.id ? feature : f)
        })
        return updated
      })
      if (selectedFeature?.id === feature.id) {
        setSelectedFeature(feature)
      }
    }
  }

  const handleScenarioSuccess = (scenario: Scenario) => {
    if (scenarioModal.mode === 'create') {
      setScenarios([...scenarios, scenario])
    } else {
      setScenarios(scenarios.map(s => s.id === scenario.id ? scenario : s))
      if (selectedScenario?.id === scenario.id) {
        setSelectedScenario(scenario)
      }
    }
  }

  // Load test cases for scenario
  const loadScenarioTestCases = async (scenario: Scenario) => {
    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch(`http://localhost:3001/api/scenarios/${scenario.id}/test-cases`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setScenarioTestCases(prev => ({
          ...prev,
          [scenario.id]: data.testCases
        }))
      }
    } catch (error) {
      console.error('Error fetching test cases for scenario:', error)
    }
  }

  // Toggle scenario expansion and load test cases if needed
  const toggleScenarioExpansion = async (scenario: Scenario) => {
    const newExpanded = new Set(expandedScenarios)
    
    if (expandedScenarios.has(scenario.id)) {
      newExpanded.delete(scenario.id)
    } else {
      newExpanded.add(scenario.id)
      // Load test cases if not already loaded
      if (!scenarioTestCases[scenario.id]) {
        await loadScenarioTestCases(scenario)
      }
    }
    
    setExpandedScenarios(newExpanded)
  }

  // Delete handlers
  const handleDeleteConfirm = async () => {
    if (!deleteModal.item) return

    try {
      switch (deleteModal.type) {
        case 'project':
          await projectsApi.delete(deleteModal.item.id)
          setProjects(projects.filter(p => p.id !== deleteModal.item!.id))
          if (selectedProject?.id === deleteModal.item.id) {
            setSelectedProject(null)
            setSelectedFeature(null)
            setSelectedScenario(null)
            setFeatures([])
            setScenarios([])
          }
          break
        case 'feature':
          await featuresApi.delete(deleteModal.item.id)
          const featureToDelete = deleteModal.item as Feature
          
          // Update both features state and featuresPerProject state
          setFeatures(features.filter(f => f.id !== featureToDelete.id))
          setFeaturesPerProject(prev => {
            const updated = { ...prev }
            // Remove the feature from its project's feature list
            Object.keys(updated).forEach(projectId => {
              updated[Number(projectId)] = updated[Number(projectId)].filter(f => f.id !== featureToDelete.id)
            })
            return updated
          })
          
          // Clear related scenarios for this feature
          setScenariosPerFeature(prev => {
            const updated = { ...prev }
            delete updated[featureToDelete.id]
            return updated
          })
          
          if (selectedFeature?.id === featureToDelete.id) {
            setSelectedFeature(null)
            setSelectedScenario(null)
            setScenarios([])
          }
          break
        case 'scenario':
          await scenariosApi.delete(deleteModal.item.id)
          setScenarios(scenarios.filter(s => s.id !== deleteModal.item!.id))
          if (selectedScenario?.id === deleteModal.item.id) {
            setSelectedScenario(null)
          }
          break
      }
    } catch (error) {
      setError(`Failed to delete ${deleteModal.type}`)
      console.error(`Error deleting ${deleteModal.type}:`, error)
      throw error // Let ConfirmModal handle loading state
    }
  }

  // File upload handlers
  const handleFiles = useCallback(async (newFiles: File[]) => {
    const imageFiles = newFiles.filter(file => file.type.startsWith('image/'))
    
    if (files.length + imageFiles.length > 25) {
      alert('Maximum 25 screenshots allowed for comprehensive testing')
      return
    }

    if (!selectedScenario) {
      alert('Please select a scenario first')
      return
    }

    // First add files to UI for immediate feedback
    const uploadedFiles: UploadedFile[] = imageFiles
      .sort((a, b) => a.name.localeCompare(b.name)) // Sort by filename to maintain consistent order
      .map(file => ({
        file,
        preview: URL.createObjectURL(file),
        id: Date.now().toString() + Math.random().toString(36).substring(2, 11),
        originalName: file.name,
        customName: file.name.replace(/\.[^/.]+$/, '') // Remove file extension for default custom name
      }))

    setFiles(prev => [...prev, ...uploadedFiles])

    // Then upload to database
    try {
      // Get current files state to ensure we use the most up-to-date custom names
      const currentFiles = files.concat(uploadedFiles)
      
      for (const uploadedFile of uploadedFiles) {
        const formData = new FormData()
        if (uploadedFile.file) {
          // Find the current version of this file to get the latest custom name
          const currentFile = currentFiles.find(f => f.id === uploadedFile.id) || uploadedFile
          formData.append('screenshot', uploadedFile.file)
          formData.append('description', currentFile.customName)
        } else {
          continue // Skip if no file object
        }

        const token = localStorage.getItem('authToken')
        const response = await fetch(`http://localhost:3001/api/screenshots/${selectedScenario.id}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData,
        })

        if (response.ok) {
          // Get the created screenshot data from the server response
          const createdScreenshot = await response.json()
          console.log('Screenshot uploaded to database:', createdScreenshot)
          
          // Update the local file state with database information
          setFiles(prevFiles => {
            const updatedFiles = [...prevFiles]
            const fileIndex = updatedFiles.findIndex(f => f.id === uploadedFile.id)
            if (fileIndex !== -1) {
              console.log(`Updating file state: ${uploadedFile.originalName} -> ID ${createdScreenshot.screenshot.id}`)
              // Use secure API endpoint for newly uploaded screenshots
              updatedFiles[fileIndex] = {
                ...updatedFiles[fileIndex],
                isExisting: true,
                screenshotId: createdScreenshot.screenshot.id,
                preview: `http://localhost:3001/api/screenshots/${createdScreenshot.screenshot.id}`
              }
            }
            return updatedFiles
          })
        } else {
          console.error('Failed to upload screenshot:', uploadedFile.originalName)
          // Don't show error for individual uploads as it might be overwhelming
          // The user can still use the screenshots for test case generation
        }
      }
      
      // Update scenario count (this could be optimized by refetching scenarios)
      if (selectedFeature) {
        await loadScenarios(selectedFeature.id)
      }
    } catch (error) {
      console.error('Error uploading screenshots:', error)
      // Don't block user from continuing - they can still generate test cases
    }
  }, [selectedScenario, files, selectedFeature, loadScenarios])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const droppedFiles = Array.from(e.dataTransfer.files)
    handleFiles(droppedFiles)
  }, [handleFiles])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      handleFiles(selectedFiles)
    }
  }, [handleFiles])

  const removeFile = async (index: number) => {
    const fileToRemove = files[index]
    
    // If it's an existing screenshot, delete from database
    if (fileToRemove.isExisting && fileToRemove.screenshotId) {
      try {
        const token = localStorage.getItem('authToken')
        const response = await fetch(`http://localhost:3001/api/screenshots/${fileToRemove.screenshotId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        
        if (!response.ok) {
          console.error('Failed to delete screenshot from database')
          alert('Failed to delete screenshot. Please try again.')
          return
        }
      } catch (error) {
        console.error('Error deleting screenshot:', error)
        alert('Error deleting screenshot. Please try again.')
        return
      }
    }

    // Remove from UI
    setFiles(prev => {
      const newFiles = [...prev]
      if (!fileToRemove.isExisting && fileToRemove.preview) {
        URL.revokeObjectURL(fileToRemove.preview)
      }
      newFiles.splice(index, 1)
      return newFiles
    })
    
    // Update scenario counts
    if (selectedFeature && fileToRemove.isExisting) {
      await loadScenarios(selectedFeature.id)
    }
  }

  const updateFileName = async (index: number, newName: string) => {
    const fileToUpdate = files[index]
    
    // Update UI immediately for better UX
    setFiles(prev => {
      const newFiles = [...prev]
      newFiles[index] = { ...newFiles[index], customName: newName }
      return newFiles
    })
    
    // If it's an existing screenshot with database ID, update in database
    if (fileToUpdate.isExisting && fileToUpdate.screenshotId) {
      try {
        console.log(`Updating screenshot name in database: ${fileToUpdate.screenshotId} -> "${newName}"`)
        const token = localStorage.getItem('authToken')
        const response = await fetch(`http://localhost:3001/api/screenshots/${fileToUpdate.screenshotId}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ description: newName })
        })
        
        if (response.ok) {
          console.log('Screenshot name updated successfully in database')
        } else {
          console.error('Failed to update screenshot name in database', response.status, response.statusText)
          // UI is already updated, but log the error
        }
      } catch (error) {
        console.error('Error updating screenshot name:', error)
        // UI is already updated, but log the error
      }
    } else if (!fileToUpdate.isExisting) {
      // For newly uploaded files that don't have database ID yet,
      // the name will be saved when the file is uploaded to the database
      console.log('File name updated for new upload, will be saved on database upload')
    } else {
      console.log('Screenshot update skipped - no database ID available', {
        isExisting: fileToUpdate.isExisting,
        screenshotId: fileToUpdate.screenshotId
      })
    }
  }

  const handleImageDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleImageDragOver = (e: React.DragEvent, _index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleImageDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null)
      return
    }

    // Use the moveFile function which has simpler logic
    moveFile(draggedIndex, dropIndex)
    setDraggedIndex(null)
  }

  const handleImageDragEnd = () => {
    setDraggedIndex(null)
  }

  const moveFile = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return
    
    setFiles(prev => {
      const newFiles = [...prev]
      const [movedFile] = newFiles.splice(fromIndex, 1)
      newFiles.splice(toIndex, 0, movedFile)
      return newFiles
    })
  }

  const generateTestCases = async () => {
    if (files.length < 1) {
      alert('Please upload at least 1 screenshot to generate test cases')
      return
    }

    if (!selectedScenario) {
      alert('Please select a scenario first')
      return
    }

    setIsGenerating(true)
    
    try {
      const formData = new FormData()
      const pageNames: string[] = []
      
      for (let index = 0; index < files.length; index++) {
        const uploadedFile = files[index]
        
        if (uploadedFile.file) {
          // New file - use the file object
          formData.append(`image${String(index).padStart(3, '0')}`, uploadedFile.file)
        } else if (uploadedFile.isExisting) {
          // Existing file - fetch from server and add to form data
          try {
            const response = await fetch(uploadedFile.preview)
            const blob = await response.blob()
            const file = new File([blob], uploadedFile.originalName, { type: blob.type })
            formData.append(`image${String(index).padStart(3, '0')}`, file)
          } catch (error) {
            console.error('Failed to fetch existing file:', uploadedFile.originalName, error)
            continue // Skip this file if we can't fetch it
          }
        }
        
        pageNames.push(uploadedFile.customName)
      }
      
      formData.append('pageNames', JSON.stringify(pageNames))
      formData.append('scenarioId', selectedScenario.id.toString())

      // Use unified API endpoint for all test case generation
      const endpoint = '/api/generate-testcases'
      
      const response = await fetch(`http://localhost:3001${endpoint}`, {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const result = await response.json()
        // Store screenshot information along with test cases for persistence
        const testCaseData = {
          ...result,
          scenarioId: selectedScenario.id,
          scenarioName: selectedScenario.name,
          projectName: selectedProject?.name,
          featureName: selectedFeature?.name,
          screenshots: files.map(file => ({
            id: file.id,
            customName: file.customName,
            originalName: file.originalName,
            preview: file.preview,
            isExisting: file.isExisting,
            screenshotId: file.screenshotId
          }))
        }
        localStorage.setItem('testCases', JSON.stringify(testCaseData))
        
        // Refresh test case list for the scenario
        await loadScenarioTestCases(selectedScenario)
        
        window.open('/results', '_blank')
      } else {
        const errorData = await response.json().catch(() => ({}))
        
        if (response.status === 503 && errorData._temporary) {
          alert(`${errorData.error}\n\nThe AI service is experiencing high demand. Please wait ${errorData.retryAfter || 30} seconds and try again.`)
        } else {
          throw new Error(errorData.error || 'Failed to process screenshots')
        }
      }
    } catch (error) {
      console.error('Error:', error)
      if (error instanceof Error && (error.message.includes('overloaded') || error.message.includes('temporarily'))) {
        alert('AI service is experiencing high demand. Please wait a moment and try again.')
      } else {
        alert('Failed to process screenshots. Please try again.')
      }
    } finally {
      setIsGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading projects...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <style jsx>{`
        .conditional-tooltip {
          position: relative;
        }
        .conditional-tooltip[data-show-tooltip="true"]::after {
          content: attr(data-tooltip-text);
          position: fixed;
          left: var(--tooltip-x, 50%);
          top: var(--tooltip-y, 50%);
          transform: translateX(-50%);
          background: #1f2937;
          color: white;
          font-size: 14px;
          font-weight: 500;
          padding: 8px 12px;
          border-radius: 8px;
          white-space: pre-wrap;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.1s ease;
          z-index: 1000;
          max-width: 600px;
          word-wrap: break-word;
          hyphens: auto;
        }
        .conditional-tooltip[data-show-tooltip="true"]:hover::after {
          opacity: 1;
        }
        .conditional-tooltip[data-show-tooltip="true"]::before {
          content: '';
          position: fixed;
          left: var(--tooltip-x, 50%);
          top: var(--tooltip-y-arrow, 50%);
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 4px solid transparent;
          border-right: 4px solid transparent;
          border-bottom: 4px solid #1f2937;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.1s ease;
          z-index: 1000;
        }
        .conditional-tooltip[data-show-tooltip="true"]:hover::before {
          opacity: 1;
        }
        .hover-tooltip {
          position: relative;
        }
        .hover-tooltip::after {
          content: attr(data-tooltip);
          position: fixed;
          left: var(--tooltip-x, 50%);
          top: var(--tooltip-y, 50%);
          transform: translateX(-50%);
          background: white;
          color: #374151;
          font-size: 12px;
          font-weight: 500;
          padding: 8px 10px;
          border-radius: 6px;
          white-space: nowrap;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.1s ease;
          z-index: 1000;
          max-width: 200px;
          word-break: break-word;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          border: 1px solid #e5e7eb;
        }
        .hover-tooltip:hover::after {
          opacity: 1;
        }
        .project-group:hover .project-actions {
          opacity: 1;
        }
        .feature-group:hover > div > .feature-actions {
          opacity: 1;
        }
        .scenario-group:hover > div > .scenario-actions {
          opacity: 1;
        }
        /* More specific hover isolation */
        .feature-group:not(.child-hovered) .feature-actions {
          transition: opacity 0.2s ease;
        }
        .feature-group:hover:not(.child-hovered) .feature-actions {
          opacity: 1;
        }
        .feature-group.child-hovered .feature-actions {
          opacity: 0 !important;
        }
      `}</style>
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link href="/" className="text-2xl font-bold text-blue-600">
                🧪 Screen2TestCases
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                Welcome, <strong>{user.name}</strong>
              </span>
              <button
                onClick={logout}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-80px)] overflow-hidden">
        {/* Sidebar */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
          <div className="p-4 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <h2 className="text-lg font-semibold text-gray-900 min-w-0 truncate">Projects</h2>
              <button
                onClick={() => openProjectModal('create')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-sm font-medium flex items-center gap-1 flex-shrink-0"
              >
                <span>+</span> Create Project
              </button>
            </div>
            
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-lg mb-4 text-sm flex-shrink-0">
                {error}
              </div>
            )}
            
            <div className="space-y-1 flex-1 overflow-y-auto overflow-x-hidden">
              {projects.map((project) => (
                <div key={project.id} className="select-none">
                  {/* Project Node */}
                  <div className="flex items-center project-group">
                    <button
                      onClick={() => {
                        toggleProjectExpansion(project.id)
                        if (!expandedProjects.has(project.id)) {
                          handleProjectSelect(project)
                        }
                      }}
                      className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-100 flex-1 text-left min-w-0"
                    >
                      <span className="text-gray-500 text-sm">
                        {expandedProjects.has(project.id) ? '▼' : '▶'}
                      </span>
                      <span className="text-blue-600">📁</span>
                      <div className="flex-1 min-w-0">
                        <div 
                          className={`font-medium text-sm truncate conditional-tooltip ${selectedProject?.id === project.id ? 'text-blue-600' : 'text-gray-900'}`}
                          ref={(el) => {
                            if (el) handleTooltipCheck(el, project.name)
                          }}
                        >
                          {project.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {project.feature_count || 0} features, {project.scenario_count || 0} scenarios
                        </div>
                      </div>
                    </button>
                    <div className="project-actions flex items-center gap-1 opacity-0 transition-opacity flex-shrink-0 ml-auto pr-2">
                      <button
                        onClick={() => openProjectModal('edit', project)}
                        className="text-gray-400 hover:text-blue-600 p-1 flex-shrink-0"
                        title="Edit Project"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => openDeleteModal('project', project)}
                        className="text-gray-400 hover:text-red-600 p-1 flex-shrink-0"
                        title="Delete Project"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  {/* Features (shown when project is expanded) */}
                  {expandedProjects.has(project.id) && (
                    <div className="ml-4">
                      {/* Add Feature Button */}
                      <div className="flex items-center px-2 py-1">
                        <button
                          onClick={() => openFeatureModal('create')}
                          className="text-green-600 hover:text-green-700 text-xs flex items-center gap-1"
                        >
                          <span>+</span> Add Feature
                        </button>
                      </div>
                      
                      {/* Feature Nodes */}
                      {(featuresPerProject[project.id] || []).map((feature) => (
                        <div key={feature.id} className="feature-group">
                          <div className="flex items-center">
                            <button
                              onClick={async () => {
                                await toggleFeatureExpansion(feature.id)
                                if (!expandedFeatures.has(feature.id)) {
                                  handleFeatureSelect(feature)
                                }
                              }}
                              className="flex items-center gap-2 px-2 py-1 rounded hover:bg-green-50 flex-1 text-left min-w-0"
                            >
                              <span className="text-gray-500 text-sm">
                                {expandedFeatures.has(feature.id) ? '▼' : '▶'}
                              </span>
                              <span className="text-green-600">📂</span>
                              <div className="flex-1 min-w-0">
                                <div 
                                  className={`font-medium text-sm truncate conditional-tooltip ${selectedFeature?.id === feature.id ? 'text-green-600' : 'text-gray-800'}`}
                                  ref={(el) => {
                                    if (el) handleTooltipCheck(el, feature.name)
                                  }}
                                >
                                  {feature.name}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {feature.scenario_count || 0} scenarios
                                </div>
                              </div>
                            </button>
                            <div className="feature-actions flex items-center gap-1 opacity-0 transition-opacity flex-shrink-0 ml-auto pr-2">
                              <button
                                onClick={() => openFeatureModal('edit', feature)}
                                className="text-gray-400 hover:text-green-600 p-1 flex-shrink-0"
                                title="Edit Feature"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => openDeleteModal('feature', feature)}
                                className="text-gray-400 hover:text-red-600 p-1 flex-shrink-0"
                                title="Delete Feature"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>

                          {/* Scenarios (shown when feature is expanded) */}
                          {expandedFeatures.has(feature.id) && (
                            <div className="ml-4">
                              {/* Add Scenario Button */}
                              <div className="flex items-center px-2 py-1">
                                <button
                                  onClick={() => openScenarioModal('create')}
                                  className="text-purple-600 hover:text-purple-700 text-xs flex items-center gap-1"
                                >
                                  <span>+</span> Add Scenario
                                </button>
                              </div>
                              
                              {/* Scenario Nodes */}
                              {(scenariosPerFeature[feature.id] || []).map((scenario) => (
                                <div 
                                  key={scenario.id} 
                                  className="scenario-group"
                                  onMouseEnter={(e) => {
                                    e.currentTarget.closest('.feature-group')?.classList.add('child-hovered')
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.closest('.feature-group')?.classList.remove('child-hovered')
                                  }}
                                >
                                  <div className="flex items-center">
                                    <button
                                      onClick={() => handleScenarioSelect(scenario)}
                                      className={`flex items-center gap-2 px-2 py-1 rounded hover:bg-purple-50 flex-1 text-left min-w-0 ${
                                        selectedScenario?.id === scenario.id ? 'bg-purple-100 border border-purple-200' : ''
                                      }`}
                                    >
                                      <span className="text-gray-400 text-sm ml-4">📄</span>
                                      <div className="flex-1 min-w-0">
                                        <div 
                                          className={`font-medium text-xs truncate conditional-tooltip ${selectedScenario?.id === scenario.id ? 'text-purple-600' : 'text-gray-800'}`}
                                          ref={(el) => {
                                            if (el) handleTooltipCheck(el, scenario.name)
                                          }}
                                        >
                                          {scenario.name}
                                        </div>
                                      </div>
                                    </button>
                                    <div className="scenario-actions flex items-center gap-1 opacity-0 transition-opacity flex-shrink-0 ml-auto pr-2">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          toggleScenarioExpansion(scenario)
                                        }}
                                        className="text-gray-400 hover:text-blue-600 p-1 flex-shrink-0"
                                        title="View Test Cases"
                                      >
                                        {expandedScenarios.has(scenario.id) ? '📁' : '📋'}
                                      </button>
                                      <button
                                        onClick={() => openScenarioModal('edit', scenario)}
                                        className="text-gray-400 hover:text-purple-600 p-1 flex-shrink-0"
                                        title="Edit Scenario"
                                      >
                                        ✏️
                                      </button>
                                      <button
                                        onClick={() => openDeleteModal('scenario', scenario)}
                                        className="text-gray-400 hover:text-red-600 p-1 flex-shrink-0"
                                        title="Delete Scenario"
                                      >
                                        🗑️
                                      </button>
                                    </div>
                                  </div>
                                  
                                  {/* Test Cases History */}
                                  {expandedScenarios.has(scenario.id) && (
                                    <div className="ml-6 mt-3 space-y-2 transition-all duration-200 ease-in-out">
                                      {scenarioTestCases[scenario.id]?.length > 0 ? (
                                        scenarioTestCases[scenario.id].map((testCaseSet: any, index: number) => (
                                          <div 
                                            key={index} 
                                            className="test-analysis-card bg-white border border-gray-200 rounded-lg overflow-hidden hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer"
                                            onClick={() => {
                                              // Load test cases into localStorage and navigate to results
                                              const testCaseData = {
                                                ...testCaseSet.testCases,
                                                scenarioId: scenario.id,
                                                scenarioName: scenario.name
                                              }
                                              localStorage.setItem("testCases", JSON.stringify(testCaseData))
                                              window.open('/results', '_blank')
                                            }}
                                          >
                                            {/* Gradient Header */}
                                            <div className="h-0.5 bg-gradient-to-r from-blue-600 to-purple-600"></div>
                                            
                                            <div className="p-3">
                                              {/* Card Top Section */}
                                              <div className="flex justify-between items-start mb-2.5">
                                                <div className="flex items-center gap-2">
                                                  {/* Icon */}
                                                  <div className="w-5 h-5 rounded flex items-center justify-center text-xs text-white bg-gradient-to-br from-blue-600 to-purple-600">
                                                    🚀
                                                  </div>
                                                  
                                                  {/* Info */}
                                                  <div>
                                                    <h4 className="text-sm font-semibold text-gray-900 leading-tight">
                                                      Unified AI Analysis
                                                    </h4>
                                                    <p className="text-xs text-gray-600">
                                                      {testCaseSet.totalCount} test cases
                                                    </p>
                                                  </div>
                                                </div>
                                                
                                                {/* Date */}
                                                <div className="bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded text-center leading-tight">
                                                  {new Date(testCaseSet.createdAt).toLocaleDateString('en-GB').slice(0, 5)}
                                                </div>
                                              </div>
                                              
                                              {/* Test Types Grid */}
                                              <div className="grid grid-cols-2 gap-1.5">
                                                {/* Functional */}
                                                <div className="flex items-center justify-between px-2 py-1.5 bg-gray-50 rounded border hover:bg-gray-100 transition-colors">
                                                  <span className="text-xs font-medium text-gray-700">Functional</span>
                                                  <span className="text-xs font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded min-w-[20px] text-center">
                                                    {testCaseSet.functionalCount || 0}
                                                  </span>
                                                </div>
                                                
                                                {/* Integration */}
                                                <div className="flex items-center justify-between px-2 py-1.5 bg-gray-50 rounded border hover:bg-gray-100 transition-colors">
                                                  <span className="text-xs font-medium text-gray-700">Integration</span>
                                                  <span className="text-xs font-bold bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded min-w-[20px] text-center">
                                                    {testCaseSet.integrationCount || 0}
                                                  </span>
                                                </div>
                                                
                                                {/* End-to-End */}
                                                <div className="flex items-center justify-between px-2 py-1.5 bg-gray-50 rounded border hover:bg-gray-100 transition-colors">
                                                  <span className="text-xs font-medium text-gray-700">E2E</span>
                                                  <span className="text-xs font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded min-w-[20px] text-center">
                                                    {testCaseSet.endToEndCount || 0}
                                                  </span>
                                                </div>
                                                
                                                {/* UI Tests */}
                                                <div className="flex items-center justify-between px-2 py-1.5 bg-gray-50 rounded border hover:bg-gray-100 transition-colors">
                                                  <span className="text-xs font-medium text-gray-700">UI</span>
                                                  <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded min-w-[20px] text-center">
                                                    {testCaseSet.uiCount || 0}
                                                  </span>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        ))
                                      ) : (
                                        <div className="text-xs text-gray-500 italic px-3 py-2 bg-gray-50 rounded border border-gray-200">
                                          💭 No test cases generated yet
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden">
          {selectedScenario ? (
            /* Upload Interface */
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="bg-white border-b border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">
                      {selectedScenario.name}
                    </h1>
                    <p className="text-sm text-gray-600">
                      {selectedProject?.name} → {selectedFeature?.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600">
                      {files.length} / 25 screenshots
                    </span>
                    <button
                      onClick={generateTestCases}
                      disabled={files.length === 0 || isGenerating}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white px-4 py-2 rounded-lg font-medium transition-all disabled:cursor-not-allowed"
                    >
                      {isGenerating ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                          Unified AI Analysis...
                        </div>
                      ) : (
                        'Generate Test Cases'
                      )}
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Upload Area */}
              <div className="flex-1 p-4 overflow-y-auto">
                {files.length === 0 ? (
                  /* Empty Upload State */
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`h-full border-2 border-dashed rounded-xl flex items-center justify-center transition-colors ${
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
                          💡 Hover steps for details • Drag cards below to reorder
                        </div>
                      </div>
                      <div className="flex items-center gap-2 overflow-x-auto pb-2">
                        {files.map((file, index) => (
                          <div key={file.id} className="flex items-center flex-shrink-0">
                            <div 
                              className={`bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl px-4 py-2 text-sm font-bold cursor-help shadow-lg relative hover-tooltip ${index === 0 ? 'first-step' : ''}`}
                              data-tooltip={file.customName}
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                e.currentTarget.style.setProperty('--tooltip-x', `${rect.left + rect.width / 2}px`);
                                e.currentTarget.style.setProperty('--tooltip-y', `${rect.bottom + 8}px`);
                              }}
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

                    {/* Enhanced Screenshot Cards */}
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
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeFile(index);
                                }}
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
                                onChange={(e) => {
                                  e.stopPropagation();
                                  updateFileName(index, e.target.value);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                placeholder="e.g., Login Page, Dashboard, User Profile..."
                                title="Use descriptive names like 'Client Registration Form' or 'Invoice Dashboard' - these names will appear in your test cases instead of generic screenshot references"
                              />
                            </div>
                          </div>

                          {/* Image container */}
                          <div className="relative mx-3 mb-3">
                            <div 
                              className="relative cursor-pointer rounded-lg overflow-hidden border border-gray-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMaximizedImage(file.preview);
                                setMaximizedImageName(file.customName);
                              }}
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
                              {/* Maximize indicator */}
                              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white bg-opacity-90 rounded-full p-2">
                                  <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                  </svg>
                                </div>
                              </div>
                            </div>
                            
                            {/* Flow indicator - positioned over bottom of image */}
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent rounded-b-lg">
                              <div className="px-3 py-2">
                                <div className="flex items-center justify-between text-white">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <span className="text-blue-300">📱</span>
                                    <div className="flex flex-col min-w-0">
                                      <span className="text-xs font-medium">Step {index + 1}</span>
                                      <span className="text-[10px] opacity-90 truncate" title={file.customName}>
                                        {file.customName}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="text-xs opacity-75 ml-2">
                                    {index === 0 && "🚀"}
                                    {index === files.length - 1 && index > 0 && "🎯"}
                                    {index > 0 && index < files.length - 1 && "⚡"}
                                  </div>
                                </div>
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
            </div>
          ) : projects.length === 0 ? (
            /* Empty State */
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-2xl">
                <div className="text-6xl mb-6">🚀</div>
                <h2 className="text-4xl font-bold text-gray-900 mb-4">
                  Ready to Generate Test Cases?
                </h2>
                <p className="text-xl text-gray-600 mb-8">
                  Create projects and organize your test scenarios. Upload screenshots of your application's UI and let AI generate comprehensive test cases automatically.
                </p>
                
                <button
                  onClick={() => openProjectModal('create')}
                  className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-4 px-12 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  <span className="flex items-center gap-3">
                    <span>📤</span>
                    Start Your First Project
                  </span>
                </button>
              </div>
            </div>
          ) : (
            /* Project Dashboard */
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-2xl">
                <div className="text-6xl mb-6">📋</div>
                <h2 className="text-4xl font-bold text-gray-900 mb-4">
                  Project Dashboard
                </h2>
                <p className="text-xl text-gray-600 mb-8">
                  Select a scenario from your projects to start uploading screenshots and generating test cases.
                </p>
                
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
                  <div className="text-3xl mb-4">📊</div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Your Projects</h3>
                  <p className="text-gray-600 text-sm mb-4">
                    You have {projects.length} project{projects.length !== 1 ? 's' : ''} with{' '}
                    {projects.reduce((total, project) => total + (project.feature_count || 0), 0)} feature{projects.reduce((total, project) => total + (project.feature_count || 0), 0) !== 1 ? 's' : ''} and{' '}
                    {projects.reduce((total, project) => total + (project.scenario_count || 0), 0)} scenario{projects.reduce((total, project) => total + (project.scenario_count || 0), 0) !== 1 ? 's' : ''}.
                  </p>
                  <button
                    onClick={() => openProjectModal('create')}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <span>+</span>
                      Add New Project
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Image Maximization Modal */}
      {maximizedImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setMaximizedImage(null);
            setMaximizedImageName('');
          }}
        >
          <div 
            className="relative max-w-full max-h-full"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={maximizedImage}
              alt={maximizedImageName}
              className="max-w-full max-h-full object-contain"
            />
            <button
              onClick={() => {
                setMaximizedImage(null);
                setMaximizedImageName('');
              }}
              className="absolute top-4 right-4 bg-red-500 hover:bg-red-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-lg transition-colors shadow-lg"
              title="Close (ESC)"
            >
              ×
            </button>
            <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 text-white px-4 py-2 rounded-lg shadow-lg">
              {maximizedImageName}
            </div>
            <div className="absolute top-4 left-4 bg-black bg-opacity-70 text-white px-3 py-1 rounded text-sm shadow-lg">
              Press ESC to close
            </div>
          </div>
        </div>
      )}

      {/* Floating Help Button */}
      <div className="fixed bottom-6 right-6 z-40">
        {/* Help Hint Tooltip */}
        {showHelpHint && (
          <div className="absolute bottom-16 right-0 mb-2 animate-bounce">
            <div 
              className="bg-gray-900 text-white text-sm px-3 py-2 rounded-lg shadow-lg relative whitespace-nowrap cursor-pointer hover:bg-gray-800 transition-colors"
              onClick={() => setShowHelpHint(false)}
            >
              Need help organizing screenshots? 
              <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
              <button 
                className="ml-2 text-gray-300 hover:text-white text-xs"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowHelpHint(false)
                }}
              >
                ✕
              </button>
            </div>
          </div>
        )}
        
        <button
          onClick={() => {
            setIsHelpPanelOpen(true)
            setShowHelpHint(false)
          }}
          className={`bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white w-14 h-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 flex items-center justify-center ${
            showHelpHint ? 'animate-pulse ring-4 ring-blue-300 ring-opacity-75' : ''
          }`}
          title="Show Journey Guide"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </button>
      </div>

      {/* Floating Help Panel */}
      {isHelpPanelOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setIsHelpPanelOpen(false)}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden transform transition-all duration-300 scale-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <span>📋</span>
                    Journey Guide
                  </h2>
                  <p className="text-blue-100 text-sm mt-1">
                    Learn how to organize your screenshots for better test generation
                  </p>
                </div>
                <button
                  onClick={() => setIsHelpPanelOpen(false)}
                  className="text-white hover:text-gray-200 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="space-y-6">
                {/* Your User Journey Section */}
                <div className="bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 text-xl">🧭</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-blue-900 mb-3">Your User Journey</h3>
                      <p className="text-sm text-blue-800 mb-4 leading-relaxed">
                        Organize your screenshots to represent a complete user flow through your application. 
                        <strong>Give each page a descriptive name</strong> (like "Login Page", "Dashboard", "User Profile") 
                        to help AI understand the context and generate more accurate test scenarios.
                      </p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="flex items-center gap-3 text-blue-700 bg-white rounded-lg px-3 py-3 shadow-sm">
                          <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"/>
                          </svg>
                          <div>
                            <div className="font-medium text-sm">Click to Zoom</div>
                            <div className="text-xs text-blue-600">Inspect screenshots in detail</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-blue-700 bg-white rounded-lg px-3 py-3 shadow-sm">
                          <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
                          </svg>
                          <div>
                            <div className="font-medium text-sm">Drag to Reorder</div>
                            <div className="text-xs text-blue-600">Organize your flow sequence</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-blue-700 bg-white rounded-lg px-3 py-3 shadow-sm">
                          <div className="w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center flex-shrink-0 font-bold">×</div>
                          <div>
                            <div className="font-medium text-sm">Remove Unwanted</div>
                            <div className="text-xs text-blue-600">Delete unnecessary screenshots</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Flow Visualization */}
                {files.length > 0 && (
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-4">
                    <h3 className="font-bold text-purple-900 mb-4 flex items-center gap-2">
                      <span className="text-xl">🔄</span>
                      Your Current Flow ({files.length} steps)
                    </h3>
                    <div className="bg-white rounded-lg p-4 shadow-inner">
                      <div className="flex items-center justify-center gap-3 flex-wrap">
                        {files.map((file, index) => (
                          <div key={file.id} className="flex items-center">
                            <div className="flex flex-col items-center group relative">
                              <div 
                                className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl px-4 py-2 text-sm font-bold shadow-lg cursor-help"
                              >
                                <div className="text-center">
                                  <div>Step {index + 1}</div>
                                  <div className="text-xs opacity-90 mt-1">
                                    {index === 0 && '🚀 Start'}
                                    {index === files.length - 1 && index > 0 && '🎯 End'}
                                    {index > 0 && index < files.length - 1 && '⚡ Process'}
                                  </div>
                                </div>
                                {/* Tooltip */}
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 max-w-xs">
                                  <div className="font-medium">{file.customName}</div>
                                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                                </div>
                              </div>
                              <div className="text-xs text-purple-700 mt-2 max-w-20 truncate font-medium text-center">
                                {file.customName}
                              </div>
                            </div>
                            {index < files.length - 1 && (
                              <div className="mx-3 text-purple-500">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="text-center mt-4">
                        <p className="text-sm text-purple-700 font-medium">
                          🎯 This flow represents your user's journey through the application
                        </p>
                        <p className="text-xs text-purple-600 mt-1">
                          💡 Hover over steps above to see page descriptions
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tips Section */}
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4">
                  <h3 className="font-bold text-amber-900 mb-3 flex items-center gap-2">
                    <span>💡</span>
                    Pro Tips
                  </h3>
                  <ul className="space-y-2 text-sm text-amber-800">
                    <li className="flex items-start gap-2">
                      <span className="text-amber-600 mt-0.5">•</span>
                      <span>Use descriptive names like "User Registration Form" instead of generic terms like "Page 1"</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-600 mt-0.5">•</span>
                      <span>Order screenshots in the sequence a user would naturally follow</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-600 mt-0.5">•</span>
                      <span>Include error states and edge cases for comprehensive test coverage</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-600 mt-0.5">•</span>
                      <span>1-25 screenshots work best - focus on key user interactions</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Modals */}
      <ProjectModal
        isOpen={projectModal.isOpen}
        onClose={closeProjectModal}
        mode={projectModal.mode}
        project={projectModal.project}
        onSuccess={handleProjectSuccess}
      />

      <FeatureModal
        isOpen={featureModal.isOpen}
        onClose={closeFeatureModal}
        mode={featureModal.mode}
        projectId={selectedProject?.id}
        feature={featureModal.feature}
        onSuccess={handleFeatureSuccess}
      />

      <ScenarioModal
        isOpen={scenarioModal.isOpen}
        onClose={closeScenarioModal}
        mode={scenarioModal.mode}
        featureId={selectedFeature?.id}
        scenario={scenarioModal.scenario}
        onSuccess={handleScenarioSuccess}
      />


      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={closeDeleteModal}
        onConfirm={handleDeleteConfirm}
        title={`Delete ${deleteModal.type}`}
        message={`Are you sure you want to delete this ${deleteModal.type}? This action cannot be undone.${deleteModal.type === 'project' ? ' All associated features and scenarios will also be deleted.' : deleteModal.type === 'feature' ? ' All associated scenarios will also be deleted.' : ''}`}
        confirmText="Delete"
        confirmButtonClass="bg-red-600 hover:bg-red-700"
      />
    </div>
  )
}

export default function Home() {
  const { user, logout, isLoading } = useAuth()
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')

  const handleAuthSuccess = (userData: any) => {
    console.log('Authentication successful:', userData)
    setAuthModalOpen(false)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Authenticated view
  if (user) {
    return <DashboardView user={user} logout={logout} />
  }

  // Unauthenticated view
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="max-w-4xl mx-auto px-4 text-center">
        <div className="text-6xl mb-6">🧪</div>
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          Screen2TestCases
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Transform your application screenshots into comprehensive test cases using AI.
          Sign in to start generating professional test scenarios.
        </p>
        
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 max-w-md mx-auto">
            <div className="text-4xl mb-4">🔐</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Authentication Required</h3>
            <p className="text-gray-600 mb-6">Please sign in to access the test case generator</p>
            
            <div className="space-y-3">
              <button
                onClick={() => {
                  setAuthMode('login')
                  setAuthModalOpen(true)
                }}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                Sign In
              </button>
              
              <button
                onClick={() => {
                  setAuthMode('signup')
                  setAuthModalOpen(true)
                }}
                className="w-full bg-white hover:bg-gray-50 text-gray-700 font-semibold py-3 px-6 rounded-lg border border-gray-300 transition-colors"
              >
                Create Account
              </button>
            </div>
          </div>
        </div>
      </div>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        mode={authMode}
        onModeChange={setAuthMode}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  )
}