import { apiRequest } from './api'

export interface Project {
  id: number
  name: string
  description?: string
  user_id: number
  created_at: string
  updated_at: string
  feature_count: number
  scenario_count: number
}

export interface CreateProjectData {
  name: string
  description?: string
}

export interface UpdateProjectData {
  name: string
  description?: string
}

export const projectsApi = {
  // Get all projects for the authenticated user
  getAll: async (): Promise<{ projects: Project[] }> => {
    return apiRequest('/projects')
  },

  // Get a specific project by ID
  getById: async (id: number): Promise<{ project: Project }> => {
    return apiRequest(`/projects/${id}`)
  },

  // Create a new project
  create: async (data: CreateProjectData): Promise<{ project: Project }> => {
    return apiRequest('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  // Update an existing project
  update: async (id: number, data: UpdateProjectData): Promise<{ project: Project }> => {
    return apiRequest(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  // Delete a project
  delete: async (id: number): Promise<{ message: string }> => {
    return apiRequest(`/projects/${id}`, {
      method: 'DELETE',
    })
  },
}