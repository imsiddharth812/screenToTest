import './globals.css'
import { Inter } from 'next/font/google'
import { AuthProvider } from './components/AuthContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Screen2TestCases',
  description: 'AI-powered test case generation from UI screenshots',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-50">
          <AuthProvider>
            {children}
          </AuthProvider>
        </div>
      </body>
    </html>
  )
}