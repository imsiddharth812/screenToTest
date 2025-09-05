'use client'

import { useEffect } from 'react'

interface ConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  onSecondary?: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  secondaryText?: string
  type?: 'warning' | 'info' | 'danger'
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  onSecondary,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  secondaryText,
  type = 'warning'
}: ConfirmationModalProps) {
  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      // Prevent background scrolling
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const getIconColor = () => {
    switch (type) {
      case 'warning': return 'text-yellow-600'
      case 'danger': return 'text-red-600'
      case 'info': return 'text-blue-600'
      default: return 'text-yellow-600'
    }
  }

  const getIcon = () => {
    switch (type) {
      case 'warning': return '⚠️'
      case 'danger': return '🚨'
      case 'info': return 'ℹ️'
      default: return '⚠️'
    }
  }

  const getConfirmButtonColor = () => {
    switch (type) {
      case 'danger': return 'bg-red-600 hover:bg-red-700'
      case 'warning': return 'bg-yellow-600 hover:bg-yellow-700'
      case 'info': return 'bg-blue-600 hover:bg-blue-700'
      default: return 'bg-blue-600 hover:bg-blue-700'
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />
        
        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-auto">
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className={`text-2xl ${getIconColor()}`}>
                {getIcon()}
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                {title}
              </h3>
            </div>
            
            {/* Message */}
            <div className="mb-6">
              <p className="text-gray-700 leading-relaxed">
                {message}
              </p>
            </div>
            
            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              >
                {cancelText}
              </button>
              
              {onSecondary && secondaryText && (
                <button
                  onClick={onSecondary}
                  className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors"
                >
                  {secondaryText}
                </button>
              )}
              
              <button
                onClick={onConfirm}
                className={`px-4 py-2 text-white rounded-lg font-medium transition-colors ${getConfirmButtonColor()}`}
              >
                {confirmText}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}