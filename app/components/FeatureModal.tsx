'use client'

import { useState, useEffect } from 'react'
import Modal from './Modal'
import { featuresApi, type Feature, type CreateFeatureData, type UpdateFeatureData } from '../services'

interface FeatureModalProps {
  isOpen: boolean
  onClose: () => void
  mode: 'create' | 'edit'
  projectId?: number
  feature?: Feature
  onSuccess: (feature: Feature) => void
}

export default function FeatureModal({ isOpen, onClose, mode, projectId, feature, onSuccess }: FeatureModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && feature) {
        setName(feature.name)
        setDescription(feature.description || '')
      } else {
        setName('')
        setDescription('')
      }
      setError('')
    }
  }, [isOpen, mode, feature])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Feature name is required')
      return
    }

    setLoading(true)

    try {
      const data: CreateFeatureData | UpdateFeatureData = {
        name: name.trim(),
        description: description.trim() || undefined,
      }

      let result: { feature: Feature }

      if (mode === 'create') {
        if (!projectId) {
          throw new Error('Project ID is required for creating a feature')
        }
        result = await featuresApi.create(projectId, data as CreateFeatureData)
      } else if (feature) {
        result = await featuresApi.update(feature.id, data as UpdateFeatureData)
      } else {
        throw new Error('Invalid feature data')
      }

      onSuccess(result.feature)
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={mode === 'create' ? 'Create Feature' : 'Edit Feature'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="featureName" className="block text-sm font-medium text-gray-700 mb-2">
            Feature Name *
          </label>
          <input
            type="text"
            id="featureName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            placeholder="Enter feature name"
            maxLength={100}
          />
        </div>

        <div>
          <label htmlFor="featureDescription" className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            id="featureDescription"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={loading}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            placeholder="Enter feature description (optional)"
          />
        </div>

        <div className="flex space-x-3 pt-4">
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
            className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : mode === 'create' ? 'Create Feature' : 'Update Feature'}
          </button>
        </div>
      </form>
    </Modal>
  )
}