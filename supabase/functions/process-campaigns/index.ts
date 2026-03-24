import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function calculateOptimalSendTime(timezone: string | null): Date | null {
  if (!timezone) return null
  try {
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hour12: false })
    const localHour = parseInt(formatter.format(now))
    const targetHour = 9
    let hoursUntilTarget = targetHour - localHour
    if (hoursUntilTarget <= 0) hoursUntilTarget += 24
    if (hoursUntilTarget < 1) return null // Close enough, send now
    return new Date(now.getTime() + hoursUntilTarget * 60 * 60 * 1000)
  } catch { return null }
}

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
    const activeProcessed = 0

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
      const { data: enrollmentsData } = await supabaseAdmin
        .from('campaign_enrollments')
        .select('*')
        .eq('campaign_id', campaign.id)
        .eq('status', 'pending')
        .is('next_send_at', null)
        .limit(100) // Process in chunks to avoid timeout
      let enrollments = enrollmentsData

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
        .select('id, first_name, company, timezone')
        .in('id', leadIds)

      const leadMap = new Map<string, { first_name: string; company: string; timezone: string | null }>()
      for (const l of leadsData || []) {
        leadMap.set(l.id, { first_name: l.first_name, company: l.company, timezone: l.timezone ?? null })
      }

      // Smart send: defer enrollments where it's not 9 AM local yet
      if (campaign.smart_send) {
        const deferredIds: string[] = []
        for (const e of enrollments || []) {
          if (e.lead_id) {
            const lead = leadMap.get(e.lead_id)
            if (lead?.timezone) {
              const optimalTime = calculateOptimalSendTime(lead.timezone)
              if (optimalTime && optimalTime > new Date()) {
                deferredIds.push(e.id)
                await supabaseAdmin.from('campaign_enrollments')
                  .update({ next_send_at: optimalTime.toISOString() })
                  .eq('id', e.id)
              }
            }
          }
        }
        // Remove deferred enrollments from the batch
        enrollments = (enrollments || []).filter(e => !deferredIds.includes(e.id))
        if (enrollments.length === 0) continue // All deferred, skip this campaign for now
      }

      // Build email batch
      const resendEmails = enrollments.map(e => {
        // Determine A/B variant
        let useVariantB = false
        if (campaign.ab_test_enabled && campaign.variant_b_subject && campaign.variant_b_body) {
          const hash = e.id.split('').reduce((sum: number, c: string) => sum + c.charCodeAt(0), 0)
          useVariantB = hash % 2 === 1
        }

        const templateSubject = useVariantB ? (campaign.variant_b_subject as string) : campaign.subject
        const templateBody = useVariantB ? (campaign.variant_b_body as string) : campaign.body

        ;(e as Record<string, unknown>)._variant = useVariantB ? 'B' : 'A'

        const lead = e.lead_id ? leadMap.get(e.lead_id) : null
        let emailBody = templateBody
          .replace(/\{\{firstName\}\}/g, lead?.first_name || '')
          .replace(/\{\{company\}\}/g, lead?.company || '')

        const emailSubject = templateSubject
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
          const emailRows = batchEnrollments.map((e, j) => {
            // Use substituted subject/body from the resend payload (not raw template)
            const sentEmail = resendEmails[i + j]
            return {
            lead_id: e.lead_id,
            from: profile.sending_email,
            to: e.email,
            subject: sentEmail?.subject || campaign.subject,
            body: sentEmail?.text || campaign.body,
            sent_at: new Date().toISOString(),
            read: true,
            direction: 'outbound',
            thread_id: `t-camp-${campaign.id}-${e.lead_id || e.id}`,
            campaign_id: campaign.id,
            provider_message_id: resendResults?.[j]?.id || null,
          }})

          await supabaseAdmin.from('emails').insert(emailRows)

          // Update enrollments to 'sent', grouped by A/B variant
          const variantAIds = batchEnrollments.filter((e: Record<string, unknown>) => e._variant === 'A').map(e => e.id)
          const variantBIds = batchEnrollments.filter((e: Record<string, unknown>) => e._variant === 'B').map(e => e.id)
          if (variantAIds.length) {
            await supabaseAdmin.from('campaign_enrollments')
              .update({ status: 'sent', sent_at: new Date().toISOString(), ab_variant: 'A' })
              .in('id', variantAIds)
          }
          if (variantBIds.length) {
            await supabaseAdmin.from('campaign_enrollments')
              .update({ status: 'sent', sent_at: new Date().toISOString(), ab_variant: 'B' })
              .in('id', variantBIds)
          }
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

    // Step 3: Process drip sequence enrollments (due steps)
    let dripProcessed = 0
    const { data: dueEnrollments } = await supabaseAdmin
      .from('campaign_enrollments')
      .select('*')
      .eq('status', 'pending')
      .not('next_send_at', 'is', null)
      .lte('next_send_at', new Date().toISOString())
      .limit(50)

    for (const enrollment of dueEnrollments || []) {
      // Fetch the campaign
      const { data: campaign } = await supabaseAdmin
        .from('campaigns')
        .select('*')
        .eq('id', enrollment.campaign_id)
        .single()

      if (!campaign || campaign.status === 'paused' || campaign.status === 'completed' || !campaign.sequence_id) continue

      // Check stop conditions
      const { data: unsub } = await supabaseAdmin.from('unsubscribes')
        .select('id').eq('email', enrollment.email).maybeSingle()
      if (unsub) {
        await supabaseAdmin.from('campaign_enrollments')
          .update({ status: 'unsubscribed' }).eq('id', enrollment.id)
        continue
      }

      // Fetch the step for current_step (column name is 'order')
      const { data: step } = await supabaseAdmin
        .from('campaign_steps')
        .select('*')
        .eq('sequence_id', campaign.sequence_id)
        .eq('order', enrollment.current_step)
        .single()

      if (!step) {
        // No more steps — mark complete
        await supabaseAdmin.from('campaign_enrollments')
          .update({ status: 'sent', next_send_at: null }).eq('id', enrollment.id)
        continue
      }

      // Fetch sender profile
      const { data: profile } = await supabaseAdmin.from('profiles')
        .select('name, sending_email').eq('id', campaign.sent_by).single()
      if (!profile?.sending_email) continue

      // Fetch lead data for merge fields
      let firstName = ''
      let company = ''
      if (enrollment.lead_id) {
        const { data: lead } = await supabaseAdmin.from('leads')
          .select('first_name, company').eq('id', enrollment.lead_id).single()
        if (lead) { firstName = lead.first_name; company = lead.company }
      }

      // Build email
      const emailSubject = step.subject.replace(/\{\{firstName\}\}/g, firstName).replace(/\{\{company\}\}/g, company)
      let emailBody = step.body.replace(/\{\{firstName\}\}/g, firstName).replace(/\{\{company\}\}/g, company)

      if (SITE_URL && emailBody.includes('{{unsubscribeLink}}')) {
        const token = crypto.randomUUID()
        emailBody = emailBody.replace(/\{\{unsubscribeLink\}\}/g,
          `${SITE_URL}/unsubscribe/${token}?email=${encodeURIComponent(enrollment.email)}`)
      }

      // Send via Resend
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${profile.name} <${profile.sending_email}>`,
          to: [enrollment.email],
          subject: emailSubject,
          text: emailBody,
        }),
      })

      if (res.ok) {
        const { id: providerMessageId } = await res.json()

        // Insert email record
        await supabaseAdmin.from('emails').insert({
          lead_id: enrollment.lead_id,
          from: profile.sending_email,
          to: enrollment.email,
          subject: emailSubject,
          body: emailBody,
          sent_at: new Date().toISOString(),
          read: true,
          direction: 'outbound',
          thread_id: `t-camp-${campaign.id}-${enrollment.lead_id || enrollment.id}`,
          campaign_id: campaign.id,
          provider_message_id: providerMessageId,
        })

        // Check if more steps exist
        const { data: nextStep } = await supabaseAdmin
          .from('campaign_steps')
          .select('delay_days')
          .eq('sequence_id', campaign.sequence_id)
          .eq('order', enrollment.current_step + 1)
          .maybeSingle()

        if (nextStep) {
          // More steps: increment and schedule next
          const nextSendAt = new Date(Date.now() + nextStep.delay_days * 24 * 60 * 60 * 1000)
          await supabaseAdmin.from('campaign_enrollments')
            .update({
              current_step: enrollment.current_step + 1,
              next_send_at: nextSendAt.toISOString(),
              sent_at: new Date().toISOString(),
            })
            .eq('id', enrollment.id)
        } else {
          // Last step — mark complete
          await supabaseAdmin.from('campaign_enrollments')
            .update({ status: 'sent', sent_at: new Date().toISOString(), next_send_at: null })
            .eq('id', enrollment.id)
        }

        dripProcessed++
      } else {
        console.error('Drip send failed:', res.status, await res.text())
      }
    }

    return new Response(JSON.stringify({
      scheduledProcessed,
      activeProcessed,
      campaignsChecked: uniqueCampaigns.length,
      dripProcessed,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('process-campaigns error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
