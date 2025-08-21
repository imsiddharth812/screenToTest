import { apiRequest, apiUpload } from './api'

export interface Screenshot {
  id: number
  scenario_id: number
  filename: string
  original_name: string
  file_path: string
  file_size: number
  mime_type: string
  description?: string
  created_at: string
  updated_at: string
}

export interface UpdateScreenshotData {
  description?: string
}

export const screenshotsApi = {
  // Get all screenshots for a scenario
  getByScenario: async (scenarioId: number): Promise<{ screenshots: Screenshot[] }> => {
    return apiRequest(`/screenshots/${scenarioId}`)
  },

  // Upload a screenshot for a scenario
  upload: async (scenarioId: number, file: File, description?: string): Promise<{ screenshot: Screenshot }> => {
    const formData = new FormData()
    formData.append('screenshot', file)
    if (description) {
      formData.append('description', description)
    }
    
    return apiUpload(`/screenshots/${scenarioId}`, formData)
  },

  // Update screenshot description
  update: async (id: number, data: UpdateScreenshotData): Promise<{ screenshot: Screenshot }> => {
    return apiRequest(`/screenshots/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  // Delete a screenshot
  delete: async (id: number): Promise<{ message: string }> => {
    return apiRequest(`/screenshots/${id}`, {
      method: 'DELETE',
    })
  },

  // Get screenshot file URL
  getFileUrl: (screenshot: Screenshot): string => {
    return `http://localhost:3001/${screenshot.file_path}`
  },
}