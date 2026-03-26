'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'

function LoginContent() {
  const [loading, setLoading] = useState(false)
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  const handleLogin = () => {
    setLoading(true)
    const redirectURI = `${window.location.origin}/auth/callback`
    const state = crypto.randomUUID().slice(0, 10)

    const params = new URLSearchParams({
      client_id: 'repsuite',
      response_type: 'code',
      redirect_uri: redirectURI,
      state,
    })

    window.location.href = `https://syk-product-usage-web-prod.herokuapp.com/__/auth/oauth2?${params}`
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">RepSuite Inventory</h1>
        <p className="text-gray-500 mt-1">Sign in with your Stryker account</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <button
        onClick={handleLogin}
        disabled={loading}
        className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Redirecting...
          </>
        ) : (
          <>
            <svg className="w-5 h-5" viewBox="0 0 21 21" fill="none">
              <rect width="9.5" height="9.5" fill="#f25022"/>
              <rect x="11.5" width="9.5" height="9.5" fill="#7fba00"/>
              <rect y="11.5" width="9.5" height="9.5" fill="#00a4ef"/>
              <rect x="11.5" y="11.5" width="9.5" height="9.5" fill="#ffb900"/>
            </svg>
            Sign in with Microsoft
          </>
        )}
      </button>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <Suspense fallback={
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900">RepSuite Inventory</h1>
            <p className="text-gray-500 mt-3">Loading...</p>
          </div>
        }>
          <LoginContent />
        </Suspense>
      </div>
    </div>
  )
}
