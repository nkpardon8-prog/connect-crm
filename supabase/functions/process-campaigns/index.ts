import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    const SITE_URL = Deno.env.get('SITE_URL') || ''

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    let scheduledProcessed = 0
    let activeProcessed = 0

    // Step 1: Claim scheduled campaigns (atomic — prevents double-sends)
    const { data: scheduledCampaigns } = await supabaseAdmin
      .from('campaigns')
      .update({ status: 'active' })
      .eq('status', 'scheduled')
      .lte('scheduled_at', new Date().toISOString())
      .is('deleted_at', null)
      .select('*')

    // Step 2: Also get active campaigns with pending enrollments (handles timeout recovery)
    const { data: activeCampaigns } = await supabaseAdmin
      .from('campaigns')
      .select('*')
      .eq('status', 'active')
      .is('deleted_at', null)

    // Merge both lists, deduplicate by id
    const allCampaigns = [...(scheduledCampaigns || []), ...(activeCampaigns || [])]
    const seenIds = new Set<string>()
    const uniqueCampaigns = allCampaigns.filter(c => {
      if (seenIds.has(c.id)) return false
      seenIds.add(c.id)
      return true
    })

    for (const campaign of uniqueCampaigns) {
      // Get pending enrollments
      const { data: enrollments } = await supabaseAdmin
        .from('campaign_enrollments')
        .select('*')
        .eq('campaign_id', campaign.id)
        .eq('status', 'pending')
        .limit(100) // Process in chunks to avoid timeout

      if (!enrollments?.length) {
        // No pending enrollments — mark completed
        await supabaseAdmin.from('campaigns')
          .update({ status: 'completed' })
          .eq('id', campaign.id)
          .eq('status', 'active')
        continue
      }

      // Get sender profile
      const { data: profile } = await supabaseAdmin.from('profiles')
        .select('name, sending_email')
        .eq('id', campaign.sent_by)
        .single()

      if (!profile?.sending_email) {
        console.error(`Campaign ${campaign.id}: sender has no sending_email`)
        continue
      }

      // Bulk-fetch lead data for merge fields
      const leadIds = enrollments.map(e => e.lead_id).filter(Boolean)
      const { data: leadsData } = await supabaseAdmin.from('leads')
        .select('id, first_name, company')
        .in('id', leadIds)

      const leadMap = new Map<string, { first_name: string; company: string }>()
      for (const l of leadsData || []) {
        leadMap.set(l.id, { first_name: l.first_name, company: l.company })
      }

      // Build email batch
      const resendEmails = enrollments.map(e => {
        const lead = e.lead_id ? leadMap.get(e.lead_id) : null
        let emailBody = campaign.body
          .replace(/\{\{firstName\}\}/g, lead?.first_name || '')
          .replace(/\{\{company\}\}/g, lead?.company || '')

        let emailSubject = campaign.subject
          .replace(/\{\{firstName\}\}/g, lead?.first_name || '')
          .replace(/\{\{company\}\}/g, lead?.company || '')

        // Unsubscribe link
        if (SITE_URL && emailBody.includes('{{unsubscribeLink}}')) {
          const token = crypto.randomUUID()
          emailBody = emailBody.replace(/\{\{unsubscribeLink\}\}/g,
            `${SITE_URL}/unsubscribe/${token}?email=${encodeURIComponent(e.email)}`)
        }

        return {
          from: `${profile.name} <${profile.sending_email}>`,
          to: [e.email],
          subject: emailSubject,
          text: emailBody,
        }
      })

      // Send via Resend batch API (chunks of 100)
      for (let i = 0; i < resendEmails.length; i += 100) {
        const chunk = resendEmails.slice(i, i + 100)
        const res = await fetch('https://api.resend.com/emails/batch', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(chunk),
        })

        if (res.ok) {
          const { data: resendResults } = await res.json()
          const batchEnrollments = enrollments.slice(i, i + 100)

          // Batch-update enrollment statuses + insert email records
          const emailRows = batchEnrollments.map((e, j) => ({
            lead_id: e.lead_id,
            from: profile.sending_email,
            to: e.email,
            subject: campaign.subject,
            body: campaign.body,
            sent_at: new Date().toISOString(),
            read: true,
            direction: 'outbound',
            thread_id: `t-camp-${campaign.id}-${e.lead_id || e.id}`,
            campaign_id: campaign.id,
            provider_message_id: resendResults?.[j]?.id || null,
          }))

          await supabaseAdmin.from('emails').insert(emailRows)

          // Update enrollments to 'sent'
          const enrollmentIds = batchEnrollments.map(e => e.id)
          await supabaseAdmin.from('campaign_enrollments')
            .update({ status: 'sent', sent_at: new Date().toISOString() })
            .in('id', enrollmentIds)
        } else {
          console.error('Resend batch failed:', res.status, await res.text())
        }

        if (i + 100 < resendEmails.length) await new Promise(r => setTimeout(r, 250))
      }

      // Check if all enrollments are now sent
      const { count: remaining } = await supabaseAdmin
        .from('campaign_enrollments')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id)
        .eq('status', 'pending')

      if (remaining === 0) {
        await supabaseAdmin.from('campaigns')
          .update({ status: 'completed' })
          .eq('id', campaign.id)
      }

      scheduledProcessed++
    }

    return new Response(JSON.stringify({
      scheduledProcessed,
      activeProcessed,
      campaignsChecked: uniqueCampaigns.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('process-campaigns error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
