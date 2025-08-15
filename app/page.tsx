'use client'

import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="max-w-4xl mx-auto px-4 text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          Screen2TestCases
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Upload screenshots of your application's UI and let AI generate comprehensive test cases automatically. 
          Get Target, Integration, System, Edge, Positive, and Negative test cases in minutes.
        </p>
        <div className="space-y-4">
          <Link 
            href="/upload"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
          >
            Upload Screenshots
          </Link>
          <div className="text-sm text-gray-500">
            Upload 3-5 screenshots to get started
          </div>
        </div>
      </div>
    </div>
  )
}