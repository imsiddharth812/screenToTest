'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from './components/AuthContext'
import AuthModal from './components/AuthModal'

interface Project {
  id: string
  name: string
  description: string
  features: Feature[]
}

interface Feature {
  id: string
  name: string
  scenarios: Scenario[]
}

interface Scenario {
  id: string
  name: string
}

interface UploadedFile {
  file: File
  preview: string
  id: string
  originalName: string
  customName: string
}

function DashboardView({ user, logout }: { user: any, logout: () => void }) {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectDescription, setNewProjectDescription] = useState('')
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null)
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null)
  const [editingItem, setEditingItem] = useState<{type: 'project' | 'feature' | 'scenario', id: string} | null>(null)
  const [editingName, setEditingName] = useState('')

  // Upload state
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [maximizedImage, setMaximizedImage] = useState<string | null>(null)
  const [maximizedImageName, setMaximizedImageName] = useState<string>('')

  const addProject = () => {
    setShowCreateProjectModal(true)
  }

  const createProject = () => {
    if (!newProjectName.trim()) {
      alert('Please enter a project name')
      return
    }
    
    const newProject: Project = {
      id: Date.now().toString(),
      name: newProjectName.trim(),
      description: newProjectDescription.trim(),
      features: []
    }
    setProjects([...projects, newProject])
    setShowCreateProjectModal(false)
    setNewProjectName('')
    setNewProjectDescription('')
  }

  const cancelCreateProject = () => {
    setShowCreateProjectModal(false)
    setNewProjectName('')
    setNewProjectDescription('')
  }

  const addFeature = (projectId: string) => {
    const newFeature: Feature = {
      id: Date.now().toString(),
      name: 'New Feature', 
      scenarios: []
    }
    setProjects(projects.map(p => 
      p.id === projectId 
        ? { ...p, features: [...p.features, newFeature] }
        : p
    ))
    setEditingItem({ type: 'feature', id: newFeature.id })
    setEditingName('New Feature')
  }

  const addScenario = (projectId: string, featureId: string) => {
    const newScenario: Scenario = {
      id: Date.now().toString(),
      name: 'New Scenario'
    }
    setProjects(projects.map(p => 
      p.id === projectId 
        ? { 
            ...p, 
            features: p.features.map(f => 
              f.id === featureId 
                ? { ...f, scenarios: [...f.scenarios, newScenario] }
                : f
            )
          }
        : p
    ))
    setEditingItem({ type: 'scenario', id: newScenario.id })
    setEditingName('New Scenario')
  }

  const deleteItem = (type: 'project' | 'feature' | 'scenario', id: string, parentId?: string, grandparentId?: string) => {
    if (type === 'project') {
      setProjects(projects.filter(p => p.id !== id))
      if (selectedProject?.id === id) {
        setSelectedProject(null)
        setSelectedFeature(null)
        setSelectedScenario(null)
      }
    } else if (type === 'feature' && parentId) {
      setProjects(projects.map(p => 
        p.id === parentId 
          ? { ...p, features: p.features.filter(f => f.id !== id) }
          : p
      ))
      if (selectedFeature?.id === id) {
        setSelectedFeature(null)
        setSelectedScenario(null)
      }
    } else if (type === 'scenario' && parentId && grandparentId) {
      setProjects(projects.map(p => 
        p.id === grandparentId 
          ? { 
              ...p, 
              features: p.features.map(f => 
                f.id === parentId 
                  ? { ...f, scenarios: f.scenarios.filter(s => s.id !== id) }
                  : f
              )
            }
          : p
      ))
      if (selectedScenario?.id === id) {
        setSelectedScenario(null)
      }
    }
  }

  const updateItemName = (type: 'project' | 'feature' | 'scenario', id: string, newName: string, parentId?: string, grandparentId?: string) => {
    if (type === 'project') {
      setProjects(projects.map(p => 
        p.id === id ? { ...p, name: newName } : p
      ))
    } else if (type === 'feature' && parentId) {
      setProjects(projects.map(p => 
        p.id === parentId 
          ? { ...p, features: p.features.map(f => f.id === id ? { ...f, name: newName } : f) }
          : p
      ))
    } else if (type === 'scenario' && parentId && grandparentId) {
      setProjects(projects.map(p => 
        p.id === grandparentId 
          ? { 
              ...p, 
              features: p.features.map(f => 
                f.id === parentId 
                  ? { ...f, scenarios: f.scenarios.map(s => s.id === id ? { ...s, name: newName } : s) }
                  : f
              )
            }
          : p
      ))
    }
  }

  const handleScenarioSelect = (scenario: Scenario) => {
    setSelectedScenario(scenario)
    // Reset upload state when selecting new scenario
    setFiles([])
    setIsGenerating(false)
    setMaximizedImage(null)
    setMaximizedImageName('')
  }

  // Upload functionality methods
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && maximizedImage) {
        setMaximizedImage(null)
        setMaximizedImageName('')
      }
    }
    
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [maximizedImage])

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
  }, [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      handleFiles(selectedFiles)
    }
  }

  const handleFiles = (newFiles: File[]) => {
    const imageFiles = newFiles.filter(file => file.type.startsWith('image/'))
    
    if (files.length + imageFiles.length > 25) {
      alert('Maximum 25 screenshots allowed for comprehensive testing')
      return
    }

    const uploadedFiles: UploadedFile[] = imageFiles
      .sort((a, b) => a.name.localeCompare(b.name)) // Sort by filename to maintain consistent order
      .map(file => ({
        file,
        preview: URL.createObjectURL(file),
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        originalName: file.name,
        customName: file.name.replace(/\.[^/.]+$/, '') // Remove file extension for default custom name
      }))

    setFiles(prev => [...prev, ...uploadedFiles])
  }

  const removeFile = (index: number) => {
    setFiles(prev => {
      const newFiles = [...prev]
      URL.revokeObjectURL(newFiles[index].preview)
      newFiles.splice(index, 1)
      return newFiles
    })
  }

  const handleImageDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleImageDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleImageDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null)
      return
    }

    setFiles(prev => {
      const newFiles = [...prev]
      const draggedFile = newFiles[draggedIndex]
      
      // Remove dragged file from its original position
      newFiles.splice(draggedIndex, 1)
      
      // Insert at new position (adjust index if dragging from earlier position)
      const adjustedDropIndex = draggedIndex < dropIndex ? dropIndex - 1 : dropIndex
      newFiles.splice(adjustedDropIndex, 0, draggedFile)
      
      return newFiles
    })
    
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

  const updateFileName = (index: number, newName: string) => {
    setFiles(prev => {
      const newFiles = [...prev]
      newFiles[index] = { ...newFiles[index], customName: newName }
      return newFiles
    })
  }

  const generateTestCases = async () => {
    if (files.length < 1) {
      alert('Please upload at least 1 screenshot to generate test cases')
      return
    }

    setIsGenerating(true)
    
    try {
      const formData = new FormData()
      files.forEach((uploadedFile, index) => {
        // Use a consistent naming pattern that preserves order
        formData.append(`image${String(index).padStart(3, '0')}`, uploadedFile.file)
      })
      
      // Send page names for better context
      const pageNames = files.map(file => file.customName)
      formData.append('pageNames', JSON.stringify(pageNames))

      const response = await fetch('http://localhost:3001/api/generate-testcases', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const result = await response.json()
        localStorage.setItem('testCases', JSON.stringify(result))
        
        router.push('/results')
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-full mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                🧪 Screen2TestCases
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-blue-50 rounded-lg px-4 py-2">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="text-sm">
                  <div className="font-medium text-gray-900">Welcome, {user.name}!</div>
                  <div className="text-gray-500">{user.email}</div>
                </div>
              </div>
              <button
                onClick={logout}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex h-screen pt-[80px]">
        {/* Sidebar - Only show when projects exist */}
        {projects.length > 0 && (
          <div className="w-80 bg-white border-r border-gray-200 shadow-sm overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Projects</h2>
              <button
                onClick={addProject}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-sm font-medium flex items-center gap-1"
              >
                <span>+</span> Create Project
              </button>
            </div>
            
            <div className="space-y-2">
              {projects.map((project) => (
                <div key={project.id} className="border border-gray-200 rounded-lg">
                  {/* Project Header */}
                  <div className="p-3 bg-gray-50 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1">
                        {editingItem?.type === 'project' && editingItem.id === project.id ? (
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onBlur={() => {
                              updateItemName('project', project.id, editingName)
                              setEditingItem(null)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                updateItemName('project', project.id, editingName)
                                setEditingItem(null)
                              }
                            }}
                            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                            maxLength={100}
                            autoFocus
                          />
                        ) : (
                          <span 
                            className="font-medium text-gray-900 cursor-pointer flex-1"
                            onClick={() => {
                              setEditingItem({ type: 'project', id: project.id })
                              setEditingName(project.name)
                            }}
                          >
                            {project.name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingItem({ type: 'project', id: project.id })
                            setEditingName(project.name)
                          }}
                          className="text-gray-400 hover:text-gray-600 p-1"
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => deleteItem('project', project.id)}
                          className="text-red-400 hover:text-red-600 p-1"
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Features */}
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-600">Features</span>
                      <button
                        onClick={() => addFeature(project.id)}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        + Add Feature
                      </button>
                    </div>
                    
                    <div className="space-y-2 ml-4">
                      {project.features.map((feature) => (
                        <div key={feature.id} className="border-l-2 border-blue-200 pl-3">
                          {/* Feature Header */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 flex-1">
                              {editingItem?.type === 'feature' && editingItem.id === feature.id ? (
                                <input
                                  type="text"
                                  value={editingName}
                                  onChange={(e) => setEditingName(e.target.value)}
                                  onBlur={() => {
                                    updateItemName('feature', feature.id, editingName, project.id)
                                    setEditingItem(null)
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      updateItemName('feature', feature.id, editingName, project.id)
                                      setEditingItem(null)
                                    }
                                  }}
                                  className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                                  maxLength={100}
                                  autoFocus
                                />
                              ) : (
                                <span 
                                  className="text-sm font-medium text-gray-800 cursor-pointer flex-1"
                                  onClick={() => {
                                    setEditingItem({ type: 'feature', id: feature.id })
                                    setEditingName(feature.name)
                                  }}
                                >
                                  {feature.name}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  setEditingItem({ type: 'feature', id: feature.id })
                                  setEditingName(feature.name)
                                }}
                                className="text-gray-400 hover:text-gray-600 text-xs p-1"
                                title="Edit"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => deleteItem('feature', feature.id, project.id)}
                                className="text-red-400 hover:text-red-600 text-xs p-1"
                                title="Delete"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                          
                          {/* Scenarios */}
                          <div className="mb-2">
                            <button
                              onClick={() => addScenario(project.id, feature.id)}
                              className="text-green-600 hover:text-green-700 text-xs font-medium mb-2"
                            >
                              + Add Scenario
                            </button>
                            
                            <div className="space-y-1 ml-4">
                              {feature.scenarios.map((scenario) => (
                                <div key={scenario.id} className="flex items-center justify-between border-l-2 border-green-200 pl-2 py-1">
                                  <div className="flex items-center gap-2 flex-1">
                                    {editingItem?.type === 'scenario' && editingItem.id === scenario.id ? (
                                      <input
                                        type="text"
                                        value={editingName}
                                        onChange={(e) => setEditingName(e.target.value)}
                                        onBlur={() => {
                                          updateItemName('scenario', scenario.id, editingName, feature.id, project.id)
                                          setEditingItem(null)
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            updateItemName('scenario', scenario.id, editingName, feature.id, project.id)
                                            setEditingItem(null)
                                          }
                                        }}
                                        className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                                        maxLength={150}
                                        autoFocus
                                      />
                                    ) : (
                                      <span 
                                        className="text-xs text-gray-700 cursor-pointer hover:text-blue-600 flex-1"
                                        onClick={() => handleScenarioSelect(scenario)}
                                      >
                                        {scenario.name}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => {
                                        setEditingItem({ type: 'scenario', id: scenario.id })
                                        setEditingName(scenario.name)
                                      }}
                                      className="text-gray-400 hover:text-gray-600 text-xs p-1"
                                      title="Edit"
                                    >
                                      ✏️
                                    </button>
                                    <button
                                      onClick={() => deleteItem('scenario', scenario.id, feature.id, project.id)}
                                      className="text-red-400 hover:text-red-600 text-xs p-1"
                                      title="Delete"
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto">
          {selectedScenario ? (
            <div className="bg-gradient-to-br from-gray-50 to-blue-50 min-h-full">
              {/* Hero Section */}
              <div className="bg-white border-b border-gray-200 shadow-sm">
                <div className="px-6 py-8">
                  <div className="text-center">
                    <h1 className="text-4xl font-bold text-gray-900 mb-4">
                      📤 {selectedScenario.name}
                    </h1>
                    <p className="text-xl text-gray-600 mb-6 max-w-3xl mx-auto">
                      Upload screenshots for this scenario to generate comprehensive test cases using AI.
                    </p>
                    <div className="flex items-center justify-center gap-8 text-sm text-gray-500">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                        <span>1-25 Screenshots Supported</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                        <span>AI-Powered Analysis</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-purple-500 rounded-full"></span>
                        <span>Multiple Export Formats</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Upload Content */}
              <div className="px-6 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  
                  {/* Left Column - Upload Area */}
                  <div className="lg:col-span-1">
                    <div className="sticky top-8">
                
                      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
                          <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <span>📤</span>
                            Upload Screenshots
                          </h2>
                          <p className="text-blue-100 text-sm mt-1">
                            Step 1: Upload your application screens
                          </p>
                        </div>
                        
                        <div className="p-6">
                          <div
                            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
                              isDragging 
                                ? 'border-blue-500 bg-blue-50 scale-105' 
                                : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                            }`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                          >
                            <div className="space-y-4">
                              <div className="text-6xl">
                                {isDragging ? '🎯' : '📁'}
                              </div>
                              <div>
                                <p className="text-lg font-medium text-gray-700 mb-2">
                                  {isDragging ? 'Drop files here!' : 'Drag & drop your screenshots'}
                                </p>
                                <p className="text-gray-500 mb-4">or</p>
                                <label className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg cursor-pointer transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105">
                                  <span className="flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                    Browse Files
                                  </span>
                                  <input
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    onChange={handleFileInput}
                                    className="hidden"
                                  />
                                </label>
                              </div>
                              <div className="bg-gray-50 rounded-lg p-3">
                                <p className="text-sm text-gray-600 font-medium">📋 Requirements:</p>
                                <ul className="text-xs text-gray-500 mt-1 space-y-1">
                                  <li>• 1-25 screenshots supported</li>
                                  <li>• PNG, JPG, JPEG formats</li>
                                  <li>• Clear, readable images</li>
                                </ul>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Screenshots & Flow */}
                  <div className="lg:col-span-2">
                    {files.length > 0 && (
                      <div className="space-y-6">
                        {/* Header Section */}
                        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                          <div className="bg-gradient-to-r from-green-600 to-blue-600 px-6 py-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                  <span>🎬</span>
                                  Your User Journey ({files.length}/25)
                                </h2>
                                <p className="text-green-100 text-sm mt-1">
                                  Step 2: Organize your application flow
                                </p>
                              </div>
                              <div className="text-right">
                                <div className="text-white text-sm">
                                  {files.length >= 1 ? '✅ Ready to process' : 'Upload screenshots to begin'}
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="p-6">
                            <div className="bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-xl p-4 mb-6">
                              <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                  <span className="text-blue-600 text-xl">🧭</span>
                                </div>
                                <div className="flex-1">
                                  <h3 className="font-bold text-blue-900 mb-2">Create Your User Journey</h3>
                                  <p className="text-sm text-blue-800 mb-3">
                                    Organize your screenshots to represent a complete user flow through your application. 
                                    <strong>Give each page a descriptive name</strong> (like "Login Page", "Dashboard", "User Profile") 
                                    to help AI understand the context and generate more accurate test scenarios.
                                  </p>
                                </div>
                              </div>
                            </div>
                        
                            {/* Flow Visualization */}
                            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-6 mb-6">
                              <h3 className="font-bold text-purple-900 mb-4 flex items-center gap-2">
                                <span className="text-xl">🔄</span>
                                Application Flow Sequence
                              </h3>
                              <div className="bg-white rounded-lg p-4 shadow-inner">
                                <div className="flex items-center justify-center gap-3 flex-wrap">
                                  {files.map((file, index) => (
                                    <div key={file.id} className="flex items-center">
                                      <div className="flex flex-col items-center group">
                                        <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl px-4 py-2 text-sm font-bold shadow-lg group-hover:shadow-xl transition-all duration-200 transform group-hover:scale-105">
                                          <div className="text-center">
                                            <div>Step {index + 1}</div>
                                            <div className="text-xs opacity-90 mt-1">
                                              {index === 0 && '🚀 Start'}
                                              {index === files.length - 1 && index > 0 && '🎯 End'}
                                              {index > 0 && index < files.length - 1 && '⚡ Process'}
                                            </div>
                                          </div>
                                        </div>
                                        <div className="text-xs text-purple-700 mt-2 max-w-24 truncate font-medium text-center" title={file.customName}>
                                          {file.customName}
                                        </div>
                                      </div>
                                      {index < files.length - 1 && (
                                        <div className="mx-3 text-purple-500 animate-pulse">
                                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                    
                        {/* Screenshots Grid */}
                        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                          <div className="bg-gradient-to-r from-orange-600 to-red-600 px-6 py-4">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                              <span>📱</span>
                              Screenshot Gallery
                            </h2>
                            <p className="text-orange-100 text-sm mt-1">
                              Step 3: Review and organize your uploaded screens
                            </p>
                          </div>
                          
                          <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6">
                              {files.map((uploadedFile, index) => (
                                <div 
                                  key={uploadedFile.id} 
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
                                        <span className="text-xs text-gray-500 truncate max-w-24" title={uploadedFile.originalName}>
                                          {uploadedFile.originalName}
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
                                        value={uploadedFile.customName}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          updateFileName(index, e.target.value);
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                        placeholder="e.g., Login Page, Dashboard, User Profile..."
                                      />
                                    </div>
                                  </div>

                                  {/* Image container */}
                                  <div className="relative mx-3 mb-3">
                                    <div 
                                      className="relative cursor-pointer rounded-lg overflow-hidden border border-gray-100"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setMaximizedImage(uploadedFile.preview);
                                        setMaximizedImageName(uploadedFile.customName);
                                      }}
                                    >
                                      <img
                                        src={uploadedFile.preview}
                                        alt={`Screenshot ${index + 1}`}
                                        className="w-full h-40 object-cover transition-transform duration-200 group-hover:scale-105"
                                        draggable={false}
                                      />
                                      {/* Maximize indicator */}
                                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white bg-opacity-90 rounded-full p-2">
                                          <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                          </svg>
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
                                      <span className="text-xs font-medium">Drag to reorder</span>
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
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Process Section */}
                {files.length >= 1 && (
                  <div className="mt-8">
                    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                      <div className="bg-gradient-to-r from-green-600 to-teal-600 px-6 py-4">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                          <span>🚀</span>
                          Generate Test Cases
                        </h2>
                        <p className="text-green-100 text-sm mt-1">
                          Step 4: Let AI analyze your screens and create comprehensive test scenarios
                        </p>
                      </div>
                      
                      <div className="p-6">
                        <div className="text-center">
                          <div className="mb-6">
                            <div className="inline-flex items-center gap-3 bg-green-50 rounded-xl px-6 py-3 border border-green-200">
                              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                <span className="text-green-600 font-bold text-lg">✓</span>
                              </div>
                              <div className="text-left">
                                <div className="font-bold text-green-900">Ready to Process!</div>
                                <div className="text-sm text-green-700">{files.length} screenshots uploaded and organized</div>
                              </div>
                            </div>
                          </div>
                          
                          <button
                            onClick={generateTestCases}
                            disabled={isGenerating}
                            className="bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold py-4 px-12 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none disabled:hover:scale-100"
                          >
                            {isGenerating ? (
                              <span className="flex items-center gap-3">
                                <svg className="animate-spin w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Processing Screenshots...
                              </span>
                            ) : (
                              <span className="flex items-center gap-3">
                                <span>🧠</span>
                                Generate Test Cases with AI
                              </span>
                            )}
                          </button>
                          
                          <div className="mt-4 text-sm text-gray-600">
                            <p>Our AI will analyze your screenshots and generate comprehensive test cases including:</p>
                            <div className="flex flex-wrap justify-center gap-4 mt-2 text-xs">
                              <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full">Functional Tests</span>
                              <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full">Integration Tests</span>
                              <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full">Edge Cases</span>
                              <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full">User Flows</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Image Maximization Modal */}
                {maximizedImage && (
                  <div 
                    className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
                    onClick={() => {
                      setMaximizedImage(null);
                      setMaximizedImageName('');
                    }}
                  >
                    <div className="relative max-w-full max-h-full">
                      {/* Screenshot Name Header */}
                      <div className="absolute top-4 left-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg shadow-lg z-10">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">📱</span>
                          <div>
                            <div className="font-bold text-sm">{maximizedImageName}</div>
                            <div className="text-xs opacity-90">Screenshot Preview</div>
                          </div>
                        </div>
                      </div>
                      
                      <img
                        src={maximizedImage}
                        alt={`Maximized screenshot: ${maximizedImageName}`}
                        className="max-w-full max-h-full object-contain"
                        onClick={(e) => e.stopPropagation()}
                      />
                      
                      <button
                        onClick={() => {
                          setMaximizedImage(null);
                          setMaximizedImageName('');
                        }}
                        className="absolute top-4 right-4 bg-red-500 hover:bg-red-600 text-white rounded-full w-10 h-10 flex items-center justify-center text-xl font-bold transition-colors shadow-lg z-10"
                        title="Close"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : projects.length === 0 ? (
            // No Projects State
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-2xl">
                <div className="text-6xl mb-6">🚀</div>
                <h2 className="text-4xl font-bold text-gray-900 mb-4">
                  Ready to Generate Test Cases?
                </h2>
                <p className="text-xl text-gray-600 mb-8">
                  Create projects and organize your test scenarios. Upload screenshots of your application's UI and let AI generate comprehensive test cases automatically.
                </p>
                
                <div className="space-y-6">
                  <button
                    onClick={addProject}
                    className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-4 px-12 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    <span className="flex items-center gap-3">
                      <span>📤</span>
                      Start Your First Project
                    </span>
                  </button>
                  
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-6 max-w-2xl mx-auto">
                    <h3 className="font-bold text-gray-900 mb-3 flex items-center justify-center gap-2">
                      <span>✨</span>
                      What You'll Get
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      <div className="bg-white rounded-lg px-3 py-2 text-blue-800 font-medium">Functional Tests</div>
                      <div className="bg-white rounded-lg px-3 py-2 text-purple-800 font-medium">Integration Tests</div>
                      <div className="bg-white rounded-lg px-3 py-2 text-green-800 font-medium">End-to-End Tests</div>
                      <div className="bg-white rounded-lg px-3 py-2 text-orange-800 font-medium">Edge Cases</div>
                      <div className="bg-white rounded-lg px-3 py-2 text-red-800 font-medium">Negative Tests</div>
                      <div className="bg-white rounded-lg px-3 py-2 text-indigo-800 font-medium">Export Options</div>
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-500">
                    <p>💡 Tip: Upload 1-25 screenshots to get the most comprehensive test coverage</p>
                  </div>
                  
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mt-6">
                    <h4 className="font-semibold text-yellow-800 mb-2 flex items-center gap-2">
                      <span>🗂️</span>
                      Organization Tips
                    </h4>
                    <div className="text-sm text-yellow-700 space-y-1">
                      <p>• <strong>Projects:</strong> Organize by application or major version</p>
                      <p>• <strong>Features:</strong> Group related functionality (e.g., "User Management", "Payment Flow")</p>
                      <p>• <strong>Scenarios:</strong> Specific test cases (e.g., "Login with Valid Credentials")</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Has Projects but No Scenario Selected
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-2xl">
                <div className="text-6xl mb-6">📋</div>
                <h2 className="text-4xl font-bold text-gray-900 mb-4">
                  Project Dashboard
                </h2>
                <p className="text-xl text-gray-600 mb-8">
                  Select a scenario from your projects to start uploading screenshots and generating test cases.
                </p>
                
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                  <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
                    <div className="text-3xl mb-4">📊</div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Your Projects</h3>
                    <p className="text-gray-600 text-sm mb-4">
                      You have {projects.length} project{projects.length !== 1 ? 's' : ''} with{' '}
                      {projects.reduce((total, project) => total + project.features.length, 0)} feature{projects.reduce((total, project) => total + project.features.length, 0) !== 1 ? 's' : ''} and{' '}
                      {projects.reduce((total, project) => total + project.features.reduce((featureTotal, feature) => featureTotal + feature.scenarios.length, 0), 0)} scenario{projects.reduce((total, project) => total + project.features.reduce((featureTotal, feature) => featureTotal + feature.scenarios.length, 0), 0) !== 1 ? 's' : ''}.
                    </p>
                    <button
                      onClick={addProject}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                    >
                      <span className="flex items-center justify-center gap-2">
                        <span>+</span>
                        Add New Project
                      </span>
                    </button>
                  </div>
                  
                  <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-xl border border-green-200 p-6">
                    <div className="text-3xl mb-4">🎯</div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Next Steps</h3>
                    <div className="text-sm text-gray-700 space-y-2">
                      <p>• Click on a <strong>scenario</strong> to start uploading screenshots</p>
                      <p>• Create new features and scenarios in your projects</p>
                      <p>• Organize your test cases logically for better results</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-6">
                  <h3 className="font-bold text-purple-900 mb-3 flex items-center justify-center gap-2">
                    <span>💡</span>
                    Pro Tips
                  </h3>
                  <div className="grid md:grid-cols-3 gap-4 text-sm">
                    <div className="bg-white rounded-lg p-3 text-center">
                      <div className="text-lg mb-1">🔍</div>
                      <div className="font-medium text-gray-900">Detailed Names</div>
                      <div className="text-gray-600 text-xs">Use descriptive names for better AI analysis</div>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center">
                      <div className="text-lg mb-1">📱</div>
                      <div className="font-medium text-gray-900">1-25 Screenshots</div>
                      <div className="text-gray-600 text-xs">Upload multiple screens per scenario</div>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center">
                      <div className="text-lg mb-1">⚡</div>
                      <div className="font-medium text-gray-900">Logical Flow</div>
                      <div className="text-gray-600 text-xs">Arrange screenshots in user journey order</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Project Creation Modal */}
      {showCreateProjectModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              cancelCreateProject();
            }
          }}
        >
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 transform animate-in">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 rounded-t-xl">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span>🚀</span>
                Create New Project
              </h2>
              <p className="text-blue-100 text-sm mt-1">
                Get started by creating your first project
              </p>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        createProject();
                      }
                      if (e.key === 'Escape') {
                        cancelCreateProject();
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="e.g., E-commerce Platform, Mobile App, Dashboard..."
                    maxLength={100}
                    autoFocus
                  />
                  <div className="flex justify-between items-center mt-1">
                    <div className="text-xs text-gray-500">
                      {newProjectName.length}/100 characters
                    </div>
                    {newProjectName.length >= 90 && (
                      <div className="text-xs text-orange-600">
                        {100 - newProjectName.length} characters remaining
                      </div>
                    )}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project Description
                    <span className="text-gray-500 font-normal"> (optional)</span>
                  </label>
                  <textarea
                    value={newProjectDescription}
                    onChange={(e) => setNewProjectDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
                    placeholder="Describe the purpose and scope of your project..."
                    rows={3}
                    maxLength={500}
                  />
                  <div className="flex justify-between items-center mt-1">
                    <div className="text-xs text-gray-500">
                      {newProjectDescription.length}/500 characters
                    </div>
                    {newProjectDescription.length >= 450 && (
                      <div className="text-xs text-orange-600">
                        {500 - newProjectDescription.length} characters remaining
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={createProject}
                  disabled={!newProjectName.trim()}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none disabled:hover:scale-100 disabled:cursor-not-allowed"
                >
                  <span className="flex items-center justify-center gap-2">
                    <span>✨</span>
                    Create Project
                  </span>
                </button>
                <button
                  onClick={cancelCreateProject}
                  className="px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Home() {
  const { user, logout, isLoading } = useAuth()
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')

  // Modal will only open when user clicks Sign In button

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

  // Unauthenticated view (should show login modal)
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