import { apiRequest } from './api'

export interface Scenario {
  id: number
  feature_id: number
  name: string
  description?: string
  testing_intent?: string
  ai_model?: string
  user_story?: string
  acceptance_criteria?: string
  business_rules?: string
  edge_cases?: string
  test_environment?: string
  coverage_level?: string
  test_types?: string[]
  created_at: string
  updated_at: string
  screenshot_count?: number
}

export interface CreateScenarioData {
  name: string
  description?: string
  testing_intent?: string
  ai_model?: string
  user_story?: string
  acceptance_criteria?: string
  business_rules?: string
  edge_cases?: string
  test_environment?: string
  coverage_level?: string
  test_types?: string[]
}

export interface UpdateScenarioData {
  name: string
  description?: string
  testing_intent?: string
  ai_model?: string
  user_story?: string
  acceptance_criteria?: string
  business_rules?: string
  edge_cases?: string
  test_environment?: string
  coverage_level?: string
  test_types?: string[]
}

export const scenariosApi = {
  // Get all scenarios for a feature
  getByFeature: async (featureId: number): Promise<{ scenarios: Scenario[] }> => {
    return apiRequest(`/features/${featureId}/scenarios`)
  },

  // Get a specific scenario by ID
  getById: async (id: number): Promise<{ scenario: Scenario }> => {
    return apiRequest(`/scenarios/${id}`)
  },

  // Create a new scenario for a feature
  create: async (featureId: number, data: CreateScenarioData): Promise<{ scenario: Scenario }> => {
    return apiRequest(`/features/${featureId}/scenarios`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  // Update an existing scenario
  update: async (id: number, data: UpdateScenarioData): Promise<{ scenario: Scenario }> => {
    return apiRequest(`/scenarios/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  // Delete a scenario
  delete: async (id: number): Promise<{ message: string }> => {
    return apiRequest(`/scenarios/${id}`, {
      method: 'DELETE',
    })
  },
}