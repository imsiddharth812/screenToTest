'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

interface User {
  id: number
  name: string
  email: string
  created_at: string
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Add a safety timeout to prevent infinite loading
    const initializeAuth = () => {
      try {
        // Check if user is already logged in on app start
        const token = localStorage.getItem('authToken')
        const storedUser = localStorage.getItem('user')
        
        if (token && storedUser) {
          try {
            const userData = JSON.parse(storedUser)
            setUser(userData)
          } catch (error) {
            console.error('Error parsing stored user data:', error)
            localStorage.removeItem('authToken')
            localStorage.removeItem('user')
          }
        }
      } catch (error) {
        console.error('Error accessing localStorage:', error)
      } finally {
        setIsLoading(false)
      }
    }

    // Use setTimeout to ensure this runs after hydration
    const timeoutId = setTimeout(initializeAuth, 100)
    
    // Safety timeout to prevent infinite loading
    const safetyTimeoutId = setTimeout(() => {
      setIsLoading(false)
    }, 2000)

    return () => {
      clearTimeout(timeoutId)
      clearTimeout(safetyTimeoutId)
    }
  }, [])

  const login = async (email: string, password: string): Promise<void> => {
    const response = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Login failed')
    }

    localStorage.setItem('authToken', data.token)
    localStorage.setItem('user', JSON.stringify(data.user))
    setUser(data.user)
  }

  const signup = async (name: string, email: string, password: string): Promise<void> => {
    const response = await fetch('http://localhost:3001/api/auth/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, email, password }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Signup failed')
    }

    localStorage.setItem('authToken', data.token)
    localStorage.setItem('user', JSON.stringify(data.user))
    setUser(data.user)
  }

  const logout = () => {
    localStorage.removeItem('authToken')
    localStorage.removeItem('user')
    localStorage.removeItem('testCases') // Clear test cases on logout
    setUser(null)
  }

  const value = {
    user,
    isLoading,
    login,
    signup,
    logout,
    isAuthenticated: !!user,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}