'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from './components/AuthContext'
import AuthModal from './components/AuthModal'

interface Project {
  id: string
  name: string
  features: Feature[]
}

interface Feature {
  id: string
  name: string
  scenarios: Scenario[]
}

interface Scenario {
  id: string
  name: string
}

function DashboardView({ user, logout }: { user: any, logout: () => void }) {
  const [projects, setProjects] = useState<Project[]>([
    {
      id: '1',
      name: 'Project Alpha',
      features: [
        {
          id: '1',
          name: 'New Feature',
          scenarios: [
            { id: '1', name: 'New Scenario' }
          ]
        }
      ]
    },
    {
      id: '2', 
      name: 'New Project',
      features: [
        {
          id: '2',
          name: 'New Feature',
          scenarios: []
        }
      ]
    }
  ])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null)
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null)
  const [editingItem, setEditingItem] = useState<{type: 'project' | 'feature' | 'scenario', id: string} | null>(null)
  const [editingName, setEditingName] = useState('')

  const addProject = () => {
    const newProject: Project = {
      id: Date.now().toString(),
      name: 'New Project',
      features: []
    }
    setProjects([...projects, newProject])
    setEditingItem({ type: 'project', id: newProject.id })
    setEditingName('New Project')
  }

  const addFeature = (projectId: string) => {
    const newFeature: Feature = {
      id: Date.now().toString(),
      name: 'New Feature', 
      scenarios: []
    }
    setProjects(projects.map(p => 
      p.id === projectId 
        ? { ...p, features: [...p.features, newFeature] }
        : p
    ))
    setEditingItem({ type: 'feature', id: newFeature.id })
    setEditingName('New Feature')
  }

  const addScenario = (projectId: string, featureId: string) => {
    const newScenario: Scenario = {
      id: Date.now().toString(),
      name: 'New Scenario'
    }
    setProjects(projects.map(p => 
      p.id === projectId 
        ? { 
            ...p, 
            features: p.features.map(f => 
              f.id === featureId 
                ? { ...f, scenarios: [...f.scenarios, newScenario] }
                : f
            )
          }
        : p
    ))
    setEditingItem({ type: 'scenario', id: newScenario.id })
    setEditingName('New Scenario')
  }

  const deleteItem = (type: 'project' | 'feature' | 'scenario', id: string, parentId?: string, grandparentId?: string) => {
    if (type === 'project') {
      setProjects(projects.filter(p => p.id !== id))
      if (selectedProject?.id === id) {
        setSelectedProject(null)
        setSelectedFeature(null)
        setSelectedScenario(null)
      }
    } else if (type === 'feature' && parentId) {
      setProjects(projects.map(p => 
        p.id === parentId 
          ? { ...p, features: p.features.filter(f => f.id !== id) }
          : p
      ))
      if (selectedFeature?.id === id) {
        setSelectedFeature(null)
        setSelectedScenario(null)
      }
    } else if (type === 'scenario' && parentId && grandparentId) {
      setProjects(projects.map(p => 
        p.id === grandparentId 
          ? { 
              ...p, 
              features: p.features.map(f => 
                f.id === parentId 
                  ? { ...f, scenarios: f.scenarios.filter(s => s.id !== id) }
                  : f
              )
            }
          : p
      ))
      if (selectedScenario?.id === id) {
        setSelectedScenario(null)
      }
    }
  }

  const updateItemName = (type: 'project' | 'feature' | 'scenario', id: string, newName: string, parentId?: string, grandparentId?: string) => {
    if (type === 'project') {
      setProjects(projects.map(p => 
        p.id === id ? { ...p, name: newName } : p
      ))
    } else if (type === 'feature' && parentId) {
      setProjects(projects.map(p => 
        p.id === parentId 
          ? { ...p, features: p.features.map(f => f.id === id ? { ...f, name: newName } : f) }
          : p
      ))
    } else if (type === 'scenario' && parentId && grandparentId) {
      setProjects(projects.map(p => 
        p.id === grandparentId 
          ? { 
              ...p, 
              features: p.features.map(f => 
                f.id === parentId 
                  ? { ...f, scenarios: f.scenarios.map(s => s.id === id ? { ...s, name: newName } : s) }
                  : f
              )
            }
          : p
      ))
    }
  }

  const handleScenarioSelect = (scenario: Scenario) => {
    setSelectedScenario(scenario)
    // Navigate to upload page when scenario is selected
    window.location.href = '/upload'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-full mx-auto px-6 py-4">
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
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="text-sm">
                  <div className="font-medium text-gray-900">Welcome, {user.name}!</div>
                  <div className="text-gray-500">{user.email}</div>
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

      {/* Main Content */}
      <div className="flex h-screen pt-[80px]">
        {/* Sidebar */}
        <div className="w-80 bg-white border-r border-gray-200 shadow-sm overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Projects</h2>
              <button
                onClick={addProject}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-sm font-medium flex items-center gap-1"
              >
                <span>+</span> Create Project
              </button>
            </div>
            
            <div className="space-y-2">
              {projects.map((project) => (
                <div key={project.id} className="border border-gray-200 rounded-lg">
                  {/* Project Header */}
                  <div className="p-3 bg-gray-50 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1">
                        {editingItem?.type === 'project' && editingItem.id === project.id ? (
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onBlur={() => {
                              updateItemName('project', project.id, editingName)
                              setEditingItem(null)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                updateItemName('project', project.id, editingName)
                                setEditingItem(null)
                              }
                            }}
                            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                            autoFocus
                          />
                        ) : (
                          <span 
                            className="font-medium text-gray-900 cursor-pointer flex-1"
                            onClick={() => {
                              setEditingItem({ type: 'project', id: project.id })
                              setEditingName(project.name)
                            }}
                          >
                            {project.name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingItem({ type: 'project', id: project.id })
                            setEditingName(project.name)
                          }}
                          className="text-gray-400 hover:text-gray-600 p-1"
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => deleteItem('project', project.id)}
                          className="text-red-400 hover:text-red-600 p-1"
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Features */}
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-600">Features</span>
                      <button
                        onClick={() => addFeature(project.id)}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        + Add Feature
                      </button>
                    </div>
                    
                    <div className="space-y-2 ml-4">
                      {project.features.map((feature) => (
                        <div key={feature.id} className="border-l-2 border-blue-200 pl-3">
                          {/* Feature Header */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 flex-1">
                              {editingItem?.type === 'feature' && editingItem.id === feature.id ? (
                                <input
                                  type="text"
                                  value={editingName}
                                  onChange={(e) => setEditingName(e.target.value)}
                                  onBlur={() => {
                                    updateItemName('feature', feature.id, editingName, project.id)
                                    setEditingItem(null)
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      updateItemName('feature', feature.id, editingName, project.id)
                                      setEditingItem(null)
                                    }
                                  }}
                                  className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                                  autoFocus
                                />
                              ) : (
                                <span 
                                  className="text-sm font-medium text-gray-800 cursor-pointer flex-1"
                                  onClick={() => {
                                    setEditingItem({ type: 'feature', id: feature.id })
                                    setEditingName(feature.name)
                                  }}
                                >
                                  {feature.name}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  setEditingItem({ type: 'feature', id: feature.id })
                                  setEditingName(feature.name)
                                }}
                                className="text-gray-400 hover:text-gray-600 text-xs p-1"
                                title="Edit"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => deleteItem('feature', feature.id, project.id)}
                                className="text-red-400 hover:text-red-600 text-xs p-1"
                                title="Delete"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                          
                          {/* Scenarios */}
                          <div className="mb-2">
                            <button
                              onClick={() => addScenario(project.id, feature.id)}
                              className="text-green-600 hover:text-green-700 text-xs font-medium mb-2"
                            >
                              + Add Scenario
                            </button>
                            
                            <div className="space-y-1 ml-4">
                              {feature.scenarios.map((scenario) => (
                                <div key={scenario.id} className="flex items-center justify-between border-l-2 border-green-200 pl-2 py-1">
                                  <div className="flex items-center gap-2 flex-1">
                                    {editingItem?.type === 'scenario' && editingItem.id === scenario.id ? (
                                      <input
                                        type="text"
                                        value={editingName}
                                        onChange={(e) => setEditingName(e.target.value)}
                                        onBlur={() => {
                                          updateItemName('scenario', scenario.id, editingName, feature.id, project.id)
                                          setEditingItem(null)
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            updateItemName('scenario', scenario.id, editingName, feature.id, project.id)
                                            setEditingItem(null)
                                          }
                                        }}
                                        className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                                        autoFocus
                                      />
                                    ) : (
                                      <span 
                                        className="text-xs text-gray-700 cursor-pointer hover:text-blue-600 flex-1"
                                        onClick={() => handleScenarioSelect(scenario)}
                                      >
                                        {scenario.name}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => {
                                        setEditingItem({ type: 'scenario', id: scenario.id })
                                        setEditingName(scenario.name)
                                      }}
                                      className="text-gray-400 hover:text-gray-600 text-xs p-1"
                                      title="Edit"
                                    >
                                      ✏️
                                    </button>
                                    <button
                                      onClick={() => deleteItem('scenario', scenario.id, feature.id, project.id)}
                                      className="text-red-400 hover:text-red-600 text-xs p-1"
                                      title="Delete"
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 p-8 overflow-y-auto">
          {selectedScenario ? (
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-4">Selected Scenario: {selectedScenario.name}</h2>
              <Link 
                href="/upload"
                className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-4 px-12 rounded-xl"
              >
                Upload Screenshots
              </Link>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-2xl">
                <div className="text-6xl mb-6">🚀</div>
                <h2 className="text-4xl font-bold text-gray-900 mb-4">
                  Ready to Generate Test Cases?
                </h2>
                <p className="text-xl text-gray-600 mb-8">
                  Create projects and organize your test scenarios. Upload screenshots of your application's UI and let AI generate comprehensive test cases automatically.
                </p>
                
                <div className="space-y-6">
                  <button
                    onClick={addProject}
                    className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-4 px-12 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    <span className="flex items-center gap-3">
                      <span>📤</span>
                      Start Your First Project
                    </span>
                  </button>
                  
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-6 max-w-2xl mx-auto">
                    <h3 className="font-bold text-gray-900 mb-3 flex items-center justify-center gap-2">
                      <span>✨</span>
                      What You'll Get
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      <div className="bg-white rounded-lg px-3 py-2 text-blue-800 font-medium">Functional Tests</div>
                      <div className="bg-white rounded-lg px-3 py-2 text-purple-800 font-medium">Integration Tests</div>
                      <div className="bg-white rounded-lg px-3 py-2 text-green-800 font-medium">End-to-End Tests</div>
                      <div className="bg-white rounded-lg px-3 py-2 text-orange-800 font-medium">Edge Cases</div>
                      <div className="bg-white rounded-lg px-3 py-2 text-red-800 font-medium">Negative Tests</div>
                      <div className="bg-white rounded-lg px-3 py-2 text-indigo-800 font-medium">Export Options</div>
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-500">
                    <p>💡 Tip: Upload 1-25 screenshots to get the most comprehensive test coverage</p>
                  </div>
                  
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mt-6">
                    <h4 className="font-semibold text-yellow-800 mb-2 flex items-center gap-2">
                      <span>🗂️</span>
                      Organization Tips
                    </h4>
                    <div className="text-sm text-yellow-700 space-y-1">
                      <p>• <strong>Projects:</strong> Organize by application or major version</p>
                      <p>• <strong>Features:</strong> Group related functionality (e.g., "User Management", "Payment Flow")</p>
                      <p>• <strong>Scenarios:</strong> Specific test cases (e.g., "Login with Valid Credentials")</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  const { user, logout, isLoading } = useAuth()
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')

  // Modal will only open when user clicks Sign In button

  const handleAuthSuccess = (userData: any) => {
    console.log('Authentication successful:', userData)
    setAuthModalOpen(false)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Authenticated view
  if (user) {
    return <DashboardView user={user} logout={logout} />
  }

  // Unauthenticated view (should show login modal)
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="max-w-4xl mx-auto px-4 text-center">
        <div className="text-6xl mb-6">🧪</div>
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          Screen2TestCases
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Transform your application screenshots into comprehensive test cases using AI.
          Sign in to start generating professional test scenarios.
        </p>
        
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 max-w-md mx-auto">
            <div className="text-4xl mb-4">🔐</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Authentication Required</h3>
            <p className="text-gray-600 mb-6">Please sign in to access the test case generator</p>
            
            <div className="space-y-3">
              <button
                onClick={() => {
                  setAuthMode('login')
                  setAuthModalOpen(true)
                }}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                Sign In
              </button>
              
              <button
                onClick={() => {
                  setAuthMode('signup')
                  setAuthModalOpen(true)
                }}
                className="w-full bg-white hover:bg-gray-50 text-gray-700 font-semibold py-3 px-6 rounded-lg border border-gray-300 transition-colors"
              >
                Create Account
              </button>
            </div>
          </div>
        </div>
      </div>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        mode={authMode}
        onModeChange={setAuthMode}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  )
}