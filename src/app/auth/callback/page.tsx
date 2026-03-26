'use client'

import { useEffect } from 'react'

/**
 * OAuth callback landing page.
 * The Heroku OAuth server may return the token as either:
 *   - URL fragment: #access_token=... (implicit flow, doesn't reach server)
 *   - Query param: ?access_token=... or ?code=...
 * This page captures both and forwards to the server route at /auth/complete.
 */
export default function AuthCallbackPage() {
  useEffect(() => {
    // Check URL fragment first (#access_token=...)
    const hash = window.location.hash.substring(1)
    if (hash) {
      const params = new URLSearchParams(hash)
      const accessToken = params.get('access_token')
      if (accessToken) {
        window.location.href = `/auth/complete?access_token=${encodeURIComponent(accessToken)}`
        return
      }
    }

    // Check query params (?access_token=... or ?code=...)
    const searchParams = new URLSearchParams(window.location.search)
    const accessToken = searchParams.get('access_token')
    const code = searchParams.get('code')

    if (accessToken) {
      window.location.href = `/auth/complete?access_token=${encodeURIComponent(accessToken)}`
    } else if (code) {
      window.location.href = `/auth/complete?code=${encodeURIComponent(code)}`
    } else {
      window.location.href = '/login?error=' + encodeURIComponent('No authentication token received.')
    }
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <svg className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-3" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-gray-500">Completing sign-in...</p>
      </div>
    </div>
  )
}
