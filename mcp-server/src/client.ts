import { createClient, SupabaseClient } from '@supabase/supabase-js'

export interface CRMContext {
  supabase: SupabaseClient
  userId: string
  userRole: 'admin' | 'employee'
  emailPrefix: string
  userName: string
  resendApiKey: string
}

export async function initContext(): Promise<CRMContext> {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const email = process.env.CRM_USER_EMAIL
  const resendApiKey = process.env.RESEND_API_KEY

  if (!url || !key || !email || !resendApiKey) {
    throw new Error(
      'Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRM_USER_EMAIL, RESEND_API_KEY'
    )
  }

  const supabase = createClient(url, key)

  // Look up user by email prefix, fallback to auth email
  const prefix = email.split('@')[0]
  let { data: profile } = await supabase
    .from('profiles')
    .select('id, name, role, email_prefix')
    .eq('email_prefix', prefix)
    .maybeSingle()

  if (!profile) {
    const { data: fallback } = await supabase
      .from('profiles')
      .select('id, name, role, email_prefix')
      .eq('email', email)
      .maybeSingle()
    profile = fallback
  }

  if (!profile) {
    throw new Error(`No profile found for email: ${email}`)
  }

  return {
    supabase,
    userId: profile.id,
    userRole: profile.role as 'admin' | 'employee',
    emailPrefix: profile.email_prefix,
    userName: profile.name,
    resendApiKey,
  }
}
