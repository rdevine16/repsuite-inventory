// Server-side RepSuite API client
// Mirrors the iOS app's RepSuiteAPI.swift for fetching cases

const REPSUITE_BASE_URL = 'https://syk-product-usage-web-prod.herokuapp.com'
const USER_AGENT = 'RepSuite/3.6.1.12865 CFNetwork/3860.300.31 Darwin/25.2.0'

interface RepSuiteCase {
  externalId: string | null
  sfId: string
  caseId: string | null
  salesRep: string | null
  surgeryDate: string | null
  patientId: string | null
  surgeonName: string | null
  status: string | null
  mako: boolean | null
  hospitalName: string | null
  covering_reps__c: string | null
  procedures: { name: string }[] | null
}

interface GetCasesResponse {
  data: {
    get_cases: {
      cases: RepSuiteCase[]
      total: number | null
    }
  }
}

interface RefreshResponse {
  data: {
    refreshJwt: {
      access_token: string
      refresh_token: string | null
      expires_in: number | null
    }
  }
}

async function graphQLRequest(
  token: string,
  operationName: string,
  variables: Record<string, unknown>,
  query: string
): Promise<Response> {
  return fetch(`${REPSUITE_BASE_URL}/api`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'User-Agent': USER_AGENT,
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    body: JSON.stringify({ operationName, variables, query }),
  })
}

export async function refreshJwt(refreshToken: string): Promise<{
  accessToken: string
  refreshToken: string | null
  expiresIn: number | null
} | null> {
  const query = `
    mutation refreshJwt($refreshToken: String) {
      refreshJwt(refresh_token: $refreshToken) {
        access_token refresh_token expires_in __typename
      }
    }
  `
  const res = await fetch(`${REPSUITE_BASE_URL}/api`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
      'Accept': '*/*',
    },
    body: JSON.stringify({
      operationName: 'refreshJwt',
      variables: { refreshToken },
      query,
    }),
  })

  if (!res.ok) return null

  const data = (await res.json()) as RefreshResponse
  const result = data?.data?.refreshJwt
  if (!result?.access_token) return null

  return {
    accessToken: result.access_token,
    refreshToken: result.refresh_token ?? null,
    expiresIn: result.expires_in ?? null,
  }
}

export async function getCases(
  token: string,
  salesTeamIds: string,
  startDate: string, // MM/dd/yyyy
  endDate: string, // MM/dd/yyyy
  pageOffset = 0,
  status = 'New,Requested,Assigned,Shipped/Ready for Surgery'
): Promise<{ cases: RepSuiteCase[]; total: number }> {
  const filters = {
    pageOffset,
    role: 'Covering Cases',
    startDate,
    endDate,
    status,
    filterSalesTeam: salesTeamIds,
    surgery_date_confirmed: true,
    timezoneOffset: 240,
  }

  const query = `
    query get_cases($filters: CaseFilter!) {
      get_cases(filters: $filters) {
        cases {
          externalId sfId caseId salesRep createdDate
          surgeryDate patientId surgeonName status
          mako as1 hospitalName favoriteCase
          covering_reps__c
          procedures { name __typename }
        }
        total
      }
    }
  `

  const res = await graphQLRequest(token, 'get_cases', { filters }, query)
  if (!res.ok) {
    throw new Error(`RepSuite API error: ${res.status}`)
  }

  const data = (await res.json()) as GetCasesResponse
  const result = data?.data?.get_cases
  return {
    cases: result?.cases ?? [],
    total: result?.total ?? 0,
  }
}

// Fetch all cases with pagination (up to 100)
export async function getAllCases(
  token: string,
  salesTeamIds: string,
  startDate: string,
  endDate: string,
  status?: string
): Promise<RepSuiteCase[]> {
  const allCases: RepSuiteCase[] = []
  let offset = 0
  const maxPages = 5

  for (let i = 0; i < maxPages; i++) {
    const { cases, total } = await getCases(token, salesTeamIds, startDate, endDate, offset, status)
    allCases.push(...cases)
    if (allCases.length >= total || cases.length === 0) break
    offset += 20
  }

  return allCases
}

// Get full case details including sets and parts
export async function getCaseById(
  token: string,
  externalId: string,
  sfId: string
): Promise<Record<string, unknown> | null> {
  const res = await fetch(
    `${REPSUITE_BASE_URL}/rest/cases/getCaseById?externalId=${externalId}&sfId=${sfId}&price=true`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': USER_AGENT,
        'Accept': '*/*',
      },
    }
  )

  if (!res.ok) return null

  try {
    return (await res.json()) as Record<string, unknown>
  } catch {
    return null
  }
}

// Format date as MM/dd/yyyy for RepSuite API
export function formatDateForAPI(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const year = date.getFullYear()
  return `${month}/${day}/${year}`
}
