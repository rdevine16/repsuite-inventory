import { createClient } from '@supabase/supabase-js'
import { createClient as createSSRClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

// Same deterministic password as iOS app (SupabaseManager.swift)
const SUPABASE_PASSWORD = 'test1234'

function decodeJWTPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/')
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4)
    const json = Buffer.from(padded, 'base64').toString('utf-8')
    return JSON.parse(json)
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)

  // Check if this is a Heroku OAuth callback with access_token or code
  const accessToken = searchParams.get('access_token')
  const code = searchParams.get('code')

  // Case 1: Heroku OAuth returned an access_token directly (implicit flow)
  if (accessToken) {
    return await handleRepSuiteToken(accessToken, origin)
  }

  // Case 2: Heroku OAuth returned a code (authorization code flow)
  // Try exchanging it for a token
  if (code) {
    // First try as a Supabase code (existing flow)
    const supabase = await createSSRClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}/`)
    }

    // If that fails, try exchanging with the Heroku token endpoint
    try {
      const redirectURI = `${origin}/auth/callback`
      const tokenRes = await fetch('https://syk-product-usage-web-prod.herokuapp.com/__/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          client_id: 'repsuite',
          grant_type: 'authorization_code',
          redirect_uri: redirectURI,
        }),
      })

      if (tokenRes.ok) {
        const tokenData = await tokenRes.json()
        if (tokenData.access_token) {
          return await handleRepSuiteToken(tokenData.access_token, origin)
        }
      }
    } catch (e) {
      console.error('Token exchange error:', e)
    }
  }

  // Check for all query params — Heroku might return token in a different param
  const allParams = Object.fromEntries(searchParams.entries())
  console.log('Auth callback params:', Object.keys(allParams))

  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Could not authenticate. Please try again.')}`)
}

async function handleRepSuiteToken(token: string, origin: string) {
  const claims = decodeJWTPayload(token)
  const email = (claims?.unique_name as string) || (claims?.email as string) || (claims?.upn as string)

  if (!email) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Could not read email from login token.')}`)
  }

  // Sign into Supabase using the same email + deterministic password as iOS
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\\n/g, ''),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.replace(/\\n/g, ''),
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Ensure the Supabase user exists (auto-create like iOS does)
  const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
  const userExists = existingUsers?.users?.some(u => u.email === email.toLowerCase())

  if (!userExists) {
    const { error: signUpError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase(),
      password: SUPABASE_PASSWORD,
      email_confirm: true,
    })
    if (signUpError) {
      console.error('Supabase user creation error:', signUpError)
    }
  }

  // Now sign in via the SSR client so cookies get set
  const supabase = await createSSRClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: email.toLowerCase(),
    password: SUPABASE_PASSWORD,
  })

  if (signInError) {
    console.error('Supabase sign-in error:', signInError)
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Supabase sign-in failed: ' + signInError.message)}`)
  }

  return NextResponse.redirect(`${origin}/`)
}
