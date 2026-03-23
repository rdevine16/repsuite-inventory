import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import * as jwt from 'jsonwebtoken'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Generate APNs JWT token
function generateAPNsToken(): string | null {
  const keyId = process.env.APNS_KEY_ID
  const teamId = process.env.APNS_TEAM_ID
  const privateKey = process.env.APNS_PRIVATE_KEY

  if (!keyId || !teamId || !privateKey) return null

  const token = jwt.sign({}, privateKey.replace(/\\n/g, '\n'), {
    algorithm: 'ES256',
    header: {
      alg: 'ES256',
      kid: keyId,
    },
    issuer: teamId,
    expiresIn: '1h',
  })

  return token
}

export async function POST(request: Request) {
  try {
    const { title, body, data } = await request.json()
    const supabase = getAdminClient()

    // Get all device tokens
    const { data: tokens } = await supabase
      .from('device_tokens')
      .select('device_token')

    if (!tokens || tokens.length === 0) {
      return NextResponse.json({ message: 'No device tokens registered' })
    }

    const apnsToken = generateAPNsToken()
    if (!apnsToken) {
      return NextResponse.json(
        { error: 'APNs not configured. Set APNS_KEY_ID, APNS_TEAM_ID, and APNS_PRIVATE_KEY env vars.' },
        { status: 500 }
      )
    }

    const bundleId = process.env.APNS_BUNDLE_ID ?? 'com.orbitsurgical.RepSuiteConnect'
    const apnsHost = process.env.APNS_ENVIRONMENT === 'production'
      ? 'https://api.push.apple.com'
      : 'https://api.sandbox.push.apple.com'

    let sent = 0
    for (const { device_token } of tokens) {
      try {
        const res = await fetch(`${apnsHost}/3/device/${device_token}`, {
          method: 'POST',
          headers: {
            'authorization': `bearer ${apnsToken}`,
            'apns-topic': bundleId,
            'apns-push-type': 'alert',
            'apns-priority': '10',
          },
          body: JSON.stringify({
            aps: {
              alert: { title, body },
              sound: 'default',
              badge: 1,
            },
            data,
          }),
        })
        if (res.ok) sent++
      } catch {
        // Continue with other tokens
      }
    }

    return NextResponse.json({ sent, total: tokens.length })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
