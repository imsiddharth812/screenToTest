'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ProtectedRoute from '../components/ProtectedRoute'
import { useAuth } from '../components/AuthContext'

interface UploadedFile {
  file: File
  preview: string
  id: string
  originalName: string
  customName: string
}

function Upload() {
  const { user, logout } = useAuth()
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [maximizedImage, setMaximizedImage] = useState<string | null>(null)
  const [maximizedImageName, setMaximizedImageName] = useState<string>('')
  const router = useRouter()

  // Handle ESC key to close maximized image
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
        
        // No more fallback messages needed since we removed mock tests
        
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
      if (error.message.includes('overloaded') || error.message.includes('temporarily')) {
        alert('AI service is experiencing high demand. Please wait a moment and try again.')
      } else {
        alert('Failed to process screenshots. Please try again.')
      }
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Header with user info */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
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
                    {user?.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="text-sm">
                  <div className="font-medium text-gray-900">Welcome, {user?.name}!</div>
                  <div className="text-gray-500">{user?.email}</div>
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

      {/* Hero Section */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              📤 Upload Screenshots
            </h1>
            <p className="text-xl text-gray-600 mb-6 max-w-3xl mx-auto">
              Transform your application screenshots into comprehensive test cases using AI.
              Upload your screens in sequence to generate intelligent test scenarios.
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

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
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
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                            <div className="flex items-center gap-2 text-blue-700 bg-white rounded-lg px-3 py-2">
                              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                              <span className="font-medium">Click to zoom & inspect</span>
                            </div>
                            <div className="flex items-center gap-2 text-blue-700 bg-white rounded-lg px-3 py-2">
                              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>
                              <span className="font-medium">Drag cards to reorder</span>
                            </div>
                            <div className="flex items-center gap-2 text-blue-700 bg-white rounded-lg px-3 py-2">
                              <span className="w-4 h-4 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center flex-shrink-0">×</span>
                              <span className="font-medium">Remove unwanted</span>
                            </div>
                          </div>
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
                          <p className="text-xs text-purple-600 mt-1">
                            Drag the screenshot cards below to reorder this sequence
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
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
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
                    
                    {/* Flow indicator - positioned over bottom of image */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent rounded-b-lg">
                      <div className="px-3 py-2">
                        <div className="flex items-center justify-between text-white">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-blue-300">📱</span>
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-medium">Step {index + 1}</span>
                              <span className="text-[10px] opacity-90 truncate" title={uploadedFile.customName}>
                                {uploadedFile.customName}
                              </span>
                            </div>
                          </div>
                          <div className="text-xs opacity-75 ml-2">
                            {index === 0 && "Start"}
                            {index === files.length - 1 && index > 0 && "End"}
                            {index > 0 && index < files.length - 1 && "→"}
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
              
              <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 text-white px-4 py-2 rounded-lg text-sm">
                <div className="flex items-center gap-2">
                  <span>💡</span>
                  <span>Press ESC or click outside to close</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ProtectedUpload() {
  return (
    <ProtectedRoute>
      <Upload />
    </ProtectedRoute>
  )
}