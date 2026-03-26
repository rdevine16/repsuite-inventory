import { createClient } from '@supabase/supabase-js'
import { createClient as createSSRClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

const SUPABASE_PASSWORD = 'test1234'
const REPSUITE_BASE_URL = 'https://syk-product-usage-web-prod.herokuapp.com'
const USER_AGENT = 'RepSuite/3.6.1.12865 CFNetwork/3860.300.31 Darwin/25.2.0'

function decodeJWTPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4)
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'))
  } catch {
    return null
  }
}

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\\n/g, ''),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.replace(/\\n/g, ''),
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function repsuiteGraphQL(token: string, operationName: string, variables: Record<string, unknown>, query: string) {
  const res = await fetch(`${REPSUITE_BASE_URL}/api`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'User-Agent': USER_AGENT,
      'Accept': '*/*',
    },
    body: JSON.stringify({ operationName, variables, query }),
  })
  if (!res.ok) return null
  return res.json()
}

// Mirrors iOS bootstrap: get_branches2 → get_user_by_branch → filter_sales_team
async function bootstrapSalesTeamIds(token: string, email: string): Promise<string | null> {
  try {
    // Step 1: Get branches
    const branchesRes = await repsuiteGraphQL(token, 'get_branches2', {}, `
      query get_branches2 {
        get_branches2 { branchID branchName mainBranch branchDivision }
      }
    `)
    const branches = branchesRes?.data?.get_branches2 ?? []
    const subBranchIds = branches
      .filter((b: { mainBranch: string | null }) => b.mainBranch !== null)
      .map((b: { branchID: string }) => b.branchID)

    if (subBranchIds.length === 0) return null

    // Step 2: Get users by branch to find our SFID
    const usersRes = await repsuiteGraphQL(token, 'get_user_by_branch', { branchIds: subBranchIds }, `
      query get_user_by_branch($branchIds: [String]) {
        get_user_by_branch(branchIds: $branchIds) { userID userName userEmail branchID }
      }
    `)
    const users = usersRes?.data?.get_user_by_branch ?? []
    const me = users.find((u: { userEmail: string | null }) =>
      (u.userEmail ?? '').toLowerCase() === email.toLowerCase()
    )

    if (!me?.userID) return null

    // Step 3: Get sales teams
    const teamsRes = await repsuiteGraphQL(token, 'filterSalesTeam', { user_sfid: me.userID }, `
      query filterSalesTeam($user_sfid: String!) {
        filter_sales_team(user_sfid: $user_sfid) { id label __typename }
      }
    `)
    const teams = teamsRes?.data?.filter_sales_team ?? []
    return teams.map((t: { id: string }) => t.id).join(',')
  } catch (e) {
    console.error('Bootstrap sales team error:', e)
    return null
  }
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const accessToken = searchParams.get('access_token')
  const code = searchParams.get('code')

  if (accessToken) {
    return await handleRepSuiteToken(accessToken, null, origin)
  }

  if (code) {
    // First try as a Supabase code (existing flow)
    const supabase = await createSSRClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}/`)
    }

    // Try exchanging with the Heroku token endpoint
    try {
      const redirectURI = `${origin}/auth/callback`
      const tokenRes = await fetch(`${REPSUITE_BASE_URL}/__/auth/token`, {
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
          return await handleRepSuiteToken(
            tokenData.access_token,
            tokenData.refresh_token ?? null,
            origin
          )
        }
      }
    } catch (e) {
      console.error('Token exchange error:', e)
    }
  }

  console.log('Auth callback params:', Object.keys(Object.fromEntries(searchParams.entries())))
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Could not authenticate. Please try again.')}`)
}

async function handleRepSuiteToken(token: string, refreshToken: string | null, origin: string) {
  const claims = decodeJWTPayload(token)
  const email = (claims?.unique_name as string) || (claims?.email as string) || (claims?.upn as string)

  if (!email) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Could not read email from login token.')}`)
  }

  const supabaseAdmin = getAdminClient()

  // Ensure the Supabase user exists
  const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
  const existingUser = existingUsers?.users?.find(u => u.email === email.toLowerCase())

  if (!existingUser) {
    const { error: signUpError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase(),
      password: SUPABASE_PASSWORD,
      email_confirm: true,
    })
    if (signUpError) {
      console.error('Supabase user creation error:', signUpError)
    }
  }

  // Sign in via SSR client so cookies get set
  const supabase = await createSSRClient()
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: email.toLowerCase(),
    password: SUPABASE_PASSWORD,
  })

  if (signInError) {
    console.error('Supabase sign-in error:', signInError)
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Sign-in failed: ' + signInError.message)}`)
  }

  // Bootstrap sales team IDs from RepSuite API (same as iOS app)
  const salesTeamIds = await bootstrapSalesTeamIds(token, email)

  // Save RepSuite token to repsuite_tokens (same as iOS syncRepSuiteToken)
  const userId = signInData.user?.id ?? existingUser?.id
  if (userId) {
    const now = new Date().toISOString()
    const expiry = claims?.exp
      ? new Date((claims.exp as number) * 1000).toISOString()
      : new Date(Date.now() + 4500 * 1000).toISOString()

    const record: Record<string, string> = {
      user_id: userId,
      access_token: token,
      refresh_token: refreshToken ?? '',
      token_expiry: expiry,
      token_status: 'active',
      error_message: '',
      updated_at: now,
    }
    if (salesTeamIds) {
      record.sales_team_ids = salesTeamIds
    }

    const { error: upsertError } = await supabaseAdmin
      .from('repsuite_tokens')
      .upsert(record, { onConflict: 'user_id' })

    if (upsertError) {
      console.error('Token sync error:', upsertError)
    } else {
      console.log(`RepSuite token synced for ${email}, sales_team_ids: ${salesTeamIds}`)
    }
  }

  return NextResponse.redirect(`${origin}/`)
}
