import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Resend API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const SITE_URL = Deno.env.get('SITE_URL') || ''

    const authHeader = req.headers.get('Authorization')!
    const { emails, campaignId } = await req.json()

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No emails provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Authenticate user and validate sending_email
    const jwt = authHeader.replace('Bearer ', '')
    const { data: { user: authUser } } = await supabaseAdmin.auth.getUser(jwt)
    if (!authUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('sending_email, name')
      .eq('id', authUser.id)
      .single()

    if (!profile?.sending_email) {
      return new Response(
        JSON.stringify({ error: 'Sending email not configured. Set it in Settings.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const validFrom = profile.sending_email
    const senderName = profile.name

    // Helper: get threading headers for replies
    async function getThreadingHeaders(threadId?: string, replyToId?: string) {
      if (!replyToId || !threadId) return {}

      const { data: replyTo } = await supabaseAdmin
        .from('emails')
        .select('provider_message_id')
        .eq('id', replyToId)
        .single()

      const { data: threadEmails } = await supabaseAdmin
        .from('emails')
        .select('provider_message_id')
        .eq('thread_id', threadId)
        .not('provider_message_id', 'is', null)
        .order('sent_at', { ascending: true })

      const headers: Record<string, string> = {}
      if (replyTo?.provider_message_id) {
        headers['In-Reply-To'] = `<${replyTo.provider_message_id}>`
      }
      if (threadEmails?.length) {
        headers['References'] = threadEmails
          .map((e: { provider_message_id: string }) => `<${e.provider_message_id}>`)
          .join(' ')
      }
      return headers
    }

    const results: unknown[] = []
    let failedCount = 0

    if (emails.length === 1) {
      // Single send (compose or reply)
      const email = emails[0]
      const threadingHeaders = await getThreadingHeaders(email.threadId, email.replyToId)

      // Generate threadId if not provided
      const threadId = email.threadId || crypto.randomUUID()

      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${senderName} <${validFrom}>`,
          to: [email.to],
          subject: email.subject,
          text: email.body,
          headers: Object.keys(threadingHeaders).length > 0 ? threadingHeaders : undefined,
        }),
      })

      if (!resendRes.ok) {
        const err = await resendRes.json()
        console.error('Resend send failed:', err)
        return new Response(
          JSON.stringify({ error: err.message || 'Failed to send email' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      const { id: providerMessageId } = await resendRes.json()

      const { data: row, error: dbErr } = await supabaseAdmin.from('emails').insert({
        lead_id: email.leadId || null,
        campaign_id: campaignId || null,
        from: validFrom,
        to: email.to,
        subject: email.subject,
        body: email.body,
        sent_at: new Date().toISOString(),
        read: true,
        direction: 'outbound',
        thread_id: threadId,
        reply_to_id: email.replyToId || null,
        provider_message_id: providerMessageId,
      }).select().single()

      if (dbErr) console.error('DB insert failed after send:', dbErr)
      results.push(row)

    } else {
      // Batch send (campaigns) — chunks of 100
      for (let i = 0; i < emails.length; i += 100) {
        const chunk = emails.slice(i, i + 100)
        // Resolve unsubscribe links per recipient before sending
        const resolvedBodies: string[] = chunk.map((email: Record<string, string>) => {
          let emailBody = email.body
          if (SITE_URL && emailBody.includes('{{unsubscribeLink}}')) {
            const unsubToken = crypto.randomUUID()
            const unsubUrl = `${SITE_URL}/unsubscribe/${unsubToken}?email=${encodeURIComponent(email.to)}`
            emailBody = emailBody.replace(/\{\{unsubscribeLink\}\}/g, unsubUrl)
          }
          return emailBody
        })

        const resendBatch = chunk.map((email: Record<string, string>, idx: number) => ({
          from: `${senderName} <${validFrom}>`,
          to: [email.to],
          subject: email.subject,
          text: resolvedBodies[idx],
        }))

        const resendRes = await fetch('https://api.resend.com/emails/batch', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(resendBatch),
        })

        if (!resendRes.ok) {
          console.error('Resend batch failed:', resendRes.status, await resendRes.text())
          failedCount += chunk.length
          continue
        }

        const { data: resendResults } = await resendRes.json()

        const rows = chunk.map((email: Record<string, string>, idx: number) => ({
          lead_id: email.leadId || null,
          campaign_id: campaignId || null,
          from: validFrom,
          to: email.to,
          subject: email.subject,
          body: resolvedBodies[idx],
          sent_at: new Date().toISOString(),
          read: true,
          direction: 'outbound',
          thread_id: email.threadId || crypto.randomUUID(),
          reply_to_id: null,
          provider_message_id: resendResults?.[idx]?.id || null,
        }))

        const { data: inserted, error: dbErr } = await supabaseAdmin
          .from('emails')
          .insert(rows)
          .select()

        if (dbErr) console.error('DB batch insert failed:', dbErr)
        results.push(...(inserted || []))

        if (i + 100 < emails.length) await new Promise(r => setTimeout(r, 250))
      }
    }

    return new Response(JSON.stringify({ emails: results, count: results.length, failedCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('send-email error:', err)
    return new Response(
      JSON.stringify({ error: (err as Error).message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
