import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import * as jwt from 'jsonwebtoken'
import http2 from 'node:http2'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Generate APNs JWT token
function generateAPNsToken(): string | null {
  const keyId = process.env.APNS_KEY_ID?.trim()
  const teamId = process.env.APNS_TEAM_ID?.trim()
  const privateKey = process.env.APNS_PRIVATE_KEY?.trim()

  if (!keyId || !teamId || !privateKey) return null

  // Replace literal \n with actual newlines (Vercel stores env vars with literal \n)
  const formattedKey = privateKey.split('\\n').join('\n')
  const token = jwt.sign({}, formattedKey, {
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

// Send push via HTTP/2 (required by APNs)
function sendAPNsPush(
  host: string,
  deviceToken: string,
  apnsToken: string,
  bundleId: string,
  payload: string
): Promise<{ ok: boolean; status: number; body: string }> {
  return new Promise((resolve) => {
    const client = http2.connect(host)
    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${deviceToken}`,
      'authorization': `bearer ${apnsToken}`,
      'apns-topic': bundleId,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
    })

    let data = ''
    req.on('response', (headers) => {
      const status = headers[':status'] as number
      req.on('data', (chunk) => { data += chunk })
      req.on('end', () => {
        client.close()
        resolve({ ok: status === 200, status, body: data })
      })
    })

    req.on('error', (err) => {
      client.close()
      resolve({ ok: false, status: 0, body: err.message })
    })

    req.write(payload)
    req.end()
  })
}

export async function POST(request: Request) {
  try {
    const { title, body, data } = await request.json()
    const supabase = getAdminClient()

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

    const bundleId = (process.env.APNS_BUNDLE_ID ?? 'com.orbitsurgical.RepSuiteConnect').trim()
    const apnsHost = process.env.APNS_ENVIRONMENT?.trim() === 'production'
      ? 'https://api.push.apple.com'
      : 'https://api.sandbox.push.apple.com'

    const payload = JSON.stringify({
      aps: {
        alert: { title, body },
        sound: 'default',
        badge: 1,
      },
      data,
    })

    let sent = 0
    const errors: string[] = []
    for (const { device_token } of tokens) {
      const result = await sendAPNsPush(apnsHost, device_token, apnsToken, bundleId, payload)
      if (result.ok) {
        sent++
      } else {
        errors.push(`${result.status}: ${result.body}`)
      }
    }

    return NextResponse.json({ sent, total: tokens.length, apnsHost, errors })
  } catch (err) {
    console.error('Push error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
