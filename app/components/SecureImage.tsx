'use client'

import { useState, useEffect } from 'react'

interface SecureImageProps {
  screenshotId: string
  alt: string
  className?: string
  onError?: () => void
}

export default function SecureImage({ screenshotId, alt, className, onError }: SecureImageProps) {
  const [imageSrc, setImageSrc] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const fetchImage = async () => {
      try {
        const token = localStorage.getItem('authToken')
        if (!token) {
          setError(true)
          onError?.()
          return
        }

        const response = await fetch(`http://localhost:3001/api/screenshots/${screenshotId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (!response.ok) {
          throw new Error('Failed to fetch image')
        }

        const blob = await response.blob()
        const imageUrl = URL.createObjectURL(blob)
        setImageSrc(imageUrl)
      } catch (err) {
        setError(true)
        onError?.()
      } finally {
        setLoading(false)
      }
    }

    fetchImage()

    return () => {
      if (imageSrc) {
        URL.revokeObjectURL(imageSrc)
      }
    }
  }, [screenshotId, onError])

  if (loading) {
    return (
      <div className={`${className} bg-gray-200 animate-pulse flex items-center justify-center`}>
        <span className="text-gray-500">Loading...</span>
      </div>
    )
  }

  if (error || !imageSrc) {
    return (
      <div className={`${className} bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-300`}>
        <span className="text-gray-500">Failed to load image</span>
      </div>
    )
  }

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={className}
      onError={() => {
        setError(true)
        onError?.()
      }}
    />
  )
}