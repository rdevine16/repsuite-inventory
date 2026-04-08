'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function assignPlanToCase(caseId: string, planId: string | null) {
  const supabase = getAdminClient()

  const { data, error } = await supabase
    .from('cases')
    .update({ plan_id: planId })
    .eq('id', caseId)
    .select('id, plan_id')

  if (error) {
    console.error('Failed to assign plan:', error)
    return { error: error.message }
  }

  if (!data || data.length === 0) {
    console.error('No rows updated — case not found:', caseId)
    return { error: 'Case not found' }
  }

  revalidatePath('/case-planning')
  return { error: null }
}
