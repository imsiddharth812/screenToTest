import { API_BASE_URL } from '../config/api'

const API_BASE_PATH = `${API_BASE_URL}/api`

const getAuthToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('authToken')
  }
  return null
}

const createHeaders = () => {
  const token = getAuthToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  
  return headers
}

const createMultipartHeaders = () => {
  const token = getAuthToken()
  const headers: Record<string, string> = {}
  
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  
  return headers
}

export const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  const url = `${API_BASE_PATH}${endpoint}`
  
  const config: RequestInit = {
    ...options,
    headers: {
      ...createHeaders(),
      ...options.headers,
    },
  }

  const response = await fetch(url, config)
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(errorData.error || `HTTP ${response.status}`)
  }

  return response.json()
}

export const apiUpload = async (endpoint: string, formData: FormData) => {
  const url = `${API_BASE_PATH}${endpoint}`
  
  const config: RequestInit = {
    method: 'POST',
    headers: createMultipartHeaders(),
    body: formData,
  }

  const response = await fetch(url, config)
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Upload failed' }))
    throw new Error(errorData.error || `HTTP ${response.status}`)
  }

  return response.json()
}