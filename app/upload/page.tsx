'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface UploadedFile {
  file: File
  preview: string
}

export default function Upload() {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const router = useRouter()

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
    
    if (files.length + imageFiles.length > 5) {
      alert('Maximum 5 images allowed')
      return
    }

    const uploadedFiles: UploadedFile[] = imageFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file)
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

  const generateTestCases = async () => {
    if (files.length < 3) {
      alert('Please upload at least 3 screenshots')
      return
    }

    setIsGenerating(true)
    
    try {
      const formData = new FormData()
      files.forEach((uploadedFile, index) => {
        formData.append(`image${index}`, uploadedFile.file)
      })

      const response = await fetch('http://localhost:3001/api/generate-testcases', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const result = await response.json()
        
        // Show AI status to user
        if (result._fallback) {
          alert('AI service temporarily unavailable. Using fallback test cases.')
        }
        
        localStorage.setItem('testCases', JSON.stringify(result))
        router.push('/results')
      } else {
        throw new Error('Failed to generate test cases')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Failed to generate test cases. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
          Upload Screenshots
        </h1>
        
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="space-y-4">
            <div className="text-6xl text-gray-400">📁</div>
            <div>
              <p className="text-lg text-gray-600">
                Drag and drop your screenshots here, or
              </p>
              <label className="inline-block mt-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded cursor-pointer">
                Browse Files
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileInput}
                  className="hidden"
                />
              </label>
            </div>
            <p className="text-sm text-gray-500">
              Upload 3-5 screenshots (PNG, JPG, JPEG)
            </p>
          </div>
        </div>

        {files.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4">
              Uploaded Screenshots ({files.length}/5)
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {files.map((uploadedFile, index) => (
                <div key={index} className="relative">
                  <img
                    src={uploadedFile.preview}
                    alt={`Screenshot ${index + 1}`}
                    className="w-full h-32 object-cover rounded-lg border"
                  />
                  <button
                    onClick={() => removeFile(index)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {files.length >= 3 && (
          <div className="mt-8 text-center">
            <button
              onClick={generateTestCases}
              disabled={isGenerating}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
            >
              {isGenerating ? 'Generating Test Cases...' : 'Generate Test Cases'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}