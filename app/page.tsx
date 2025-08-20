'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from './components/AuthContext'
import AuthModal from './components/AuthModal'

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
    return (
      <div className="min-h-screen">
        {/* Header with user info */}
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 py-4">
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

        {/* Main content */}
        <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 80px)' }}>
          <div className="max-w-4xl mx-auto px-4 text-center">
            <div className="mb-8">
              <div className="text-6xl mb-6">🚀</div>
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Ready to Generate Test Cases?
              </h2>
              <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
                Upload screenshots of your application's UI and let AI generate comprehensive test cases automatically. 
                Get Functional, Integration, End-to-End, Edge Cases, and more in minutes.
              </p>
            </div>
            
            <div className="space-y-6">
              <Link 
                href="/upload"
                className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-4 px-12 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                <span className="flex items-center gap-3">
                  <span>📤</span>
                  Start Uploading Screenshots
                </span>
              </Link>
              
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
            </div>
          </div>
        </div>
      </div>
    )
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