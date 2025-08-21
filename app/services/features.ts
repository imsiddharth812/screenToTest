import { apiRequest } from './api'

export interface Feature {
  id: number
  project_id: number
  name: string
  description?: string
  created_at: string
  updated_at: string
  scenario_count: number
}

export interface CreateFeatureData {
  name: string
  description?: string
}

export interface UpdateFeatureData {
  name: string
  description?: string
}

export const featuresApi = {
  // Get all features for a project
  getByProject: async (projectId: number): Promise<{ features: Feature[] }> => {
    return apiRequest(`/projects/${projectId}/features`)
  },

  // Get a specific feature by ID
  getById: async (id: number): Promise<{ feature: Feature }> => {
    return apiRequest(`/features/${id}`)
  },

  // Create a new feature for a project
  create: async (projectId: number, data: CreateFeatureData): Promise<{ feature: Feature }> => {
    return apiRequest(`/projects/${projectId}/features`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  // Update an existing feature
  update: async (id: number, data: UpdateFeatureData): Promise<{ feature: Feature }> => {
    return apiRequest(`/features/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  // Delete a feature
  delete: async (id: number): Promise<{ message: string }> => {
    return apiRequest(`/features/${id}`, {
      method: 'DELETE',
    })
  },
}