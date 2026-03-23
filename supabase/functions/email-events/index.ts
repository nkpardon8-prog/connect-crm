import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Webhook } from 'https://esm.sh/svix'

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const WEBHOOK_SECRET = Deno.env.get('RESEND_WEBHOOK_SECRET')
    const rawBody = await req.text()

    // Verify svix signature if secret is configured
    if (WEBHOOK_SECRET) {
      const wh = new Webhook(WEBHOOK_SECRET)
      try {
        wh.verify(rawBody, {
          'svix-id': req.headers.get('svix-id') || '',
          'svix-timestamp': req.headers.get('svix-timestamp') || '',
          'svix-signature': req.headers.get('svix-signature') || '',
        })
      } catch (verifyErr) {
        console.error('Webhook signature verification failed:', verifyErr)
        return new Response('Invalid signature', { status: 401 })
      }
    }

    const event = JSON.parse(rawBody)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const emailId = event.data?.email_id
    if (!emailId) {
      console.log('No email_id in webhook event, skipping')
      return new Response('OK', { status: 200 })
    }

    console.log(`Processing ${event.type} for email ${emailId}`)

    switch (event.type) {
      case 'email.bounced': {
        const { data: email } = await supabaseAdmin.from('emails')
          .update({ bounced_at: event.created_at })
          .eq('provider_message_id', emailId)
          .select('lead_id')
          .single()

        if (email?.lead_id) {
          await supabaseAdmin.from('leads')
            .update({ email_status: 'invalid' })
            .eq('id', email.lead_id)
          console.log(`Marked lead ${email.lead_id} as invalid due to bounce`)
        }
        break
      }

      case 'email.opened': {
        await supabaseAdmin.from('emails')
          .update({ opened_at: event.created_at })
          .eq('provider_message_id', emailId)
        break
      }

      case 'email.clicked': {
        await supabaseAdmin.from('emails')
          .update({ clicked_at: event.created_at })
          .eq('provider_message_id', emailId)
        break
      }

      case 'email.complained': {
        const { data: email } = await supabaseAdmin.from('emails')
          .update({ bounced_at: event.created_at })
          .eq('provider_message_id', emailId)
          .select('lead_id')
          .single()

        if (email?.lead_id) {
          await supabaseAdmin.from('leads')
            .update({ email_status: 'invalid' })
            .eq('id', email.lead_id)
          console.log(`Marked lead ${email.lead_id} as invalid due to spam complaint`)
        }
        break
      }

      case 'email.received': {
        const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
        if (!RESEND_API_KEY) {
          console.error('RESEND_API_KEY not set, cannot fetch inbound email body')
          break
        }

        const inboundEmailId = event.data.email_id
        const fromRaw = event.data.from as string
        const toRaw = event.data.to as string[]
        const inboundSubject = event.data.subject || '(no subject)'

        // Idempotency: skip if already processed
        const { data: existing } = await supabaseAdmin.from('emails')
          .select('id')
          .eq('provider_message_id', inboundEmailId)
          .maybeSingle()

        if (existing) {
          console.log(`Duplicate webhook for email ${inboundEmailId}, skipping`)
          break
        }

        // Step 1: Fetch full email body + headers from Resend API
        const emailRes = await fetch(
          `https://api.resend.com/emails/receiving/${inboundEmailId}`,
          { headers: { 'Authorization': `Bearer ${RESEND_API_KEY}` } }
        )

        if (!emailRes.ok) {
          console.error('Failed to fetch inbound email body:', emailRes.status)
          break
        }

        const emailData = await emailRes.json()
        const inboundBody = emailData.text || emailData.html || ''
        const emailHeaders = emailData.headers || {}

        // Step 2: Parse email addresses
        const fromMatch = fromRaw.match(/<(.+?)>/)
        const fromEmail = fromMatch ? fromMatch[1] : fromRaw
        const toMatch = toRaw[0]?.match(/<(.+?)>/)
        const toEmail = toMatch ? toMatch[1] : (toRaw[0] || '')

        // Step 3: Thread matching
        // Strategy: collect ALL message IDs from In-Reply-To + References headers,
        // then search our DB for any match. Resend sends via Amazon SES, so the
        // outbound Message-ID is an SES ID (not our provider_message_id UUID).
        // We also check provider_message_id for emails we inserted ourselves.
        let threadId: string | null = null
        let replyToId: string | null = null

        const inReplyTo = emailHeaders['in-reply-to'] || emailHeaders['In-Reply-To'] || ''
        const references = emailHeaders['references'] || emailHeaders['References'] || ''

        // Collect all message IDs from both headers
        const allRefs: string[] = []
        const refStr = typeof references === 'string' ? references : (Array.isArray(references) ? references.join(' ') : '')
        const replyStr = typeof inReplyTo === 'string' ? inReplyTo : ''

        // Extract all <...> message IDs
        const msgIdPattern = /<([^>]+)>/g
        let match
        for (const str of [replyStr, refStr]) {
          while ((match = msgIdPattern.exec(str)) !== null) {
            allRefs.push(match[1])
          }
        }

        // Search DB: try matching provider_message_id (our UUID) or look for
        // the SES message ID pattern in provider_message_id
        for (const ref of allRefs) {
          if (threadId) break

          // Try exact match first (for emails we inserted via inbound)
          const { data: exactMatch } = await supabaseAdmin.from('emails')
            .select('id, thread_id')
            .eq('provider_message_id', ref)
            .maybeSingle()

          if (exactMatch) {
            threadId = exactMatch.thread_id
            replyToId = exactMatch.id
            break
          }

          // Try prefix match (our stored UUID might be prefix of SES Message-ID)
          const uuidPart = ref.split('@')[0]
          const { data: prefixMatch } = await supabaseAdmin.from('emails')
            .select('id, thread_id')
            .like('provider_message_id', `${uuidPart}%`)
            .maybeSingle()

          if (prefixMatch) {
            threadId = prefixMatch.thread_id
            replyToId = prefixMatch.id
            break
          }
        }

        // Fallback: if no thread match via message IDs, try matching by
        // conversation participants — find the most recent outbound email TO
        // this sender's address. This handles the case where Resend/SES assigns
        // a different Message-ID than our stored provider_message_id.
        if (!threadId && fromEmail) {
          const { data: recentOutbound } = await supabaseAdmin.from('emails')
            .select('id, thread_id')
            .eq('to', fromEmail)
            .eq('direction', 'outbound')
            .not('thread_id', 'is', null)
            .order('sent_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (recentOutbound) {
            threadId = recentOutbound.thread_id
            replyToId = recentOutbound.id
            console.log(`Thread matched via sender address fallback: ${threadId}`)
          }
        }

        if (!threadId) {
          threadId = crypto.randomUUID()
        }

        // Step 4: Match sender to a CRM lead (include assigned_to for activity)
        const { data: matchedLead } = await supabaseAdmin.from('leads')
          .select('id, assigned_to')
          .eq('email', fromEmail)
          .is('deleted_at', null)
          .maybeSingle()

        // Step 5: Insert inbound email
        const { error: insertErr } = await supabaseAdmin.from('emails').insert({
          lead_id: matchedLead?.id || null,
          from: fromEmail,
          to: toEmail,
          subject: inboundSubject,
          body: inboundBody,
          sent_at: event.created_at,
          read: false,
          direction: 'inbound',
          thread_id: threadId,
          reply_to_id: replyToId,
          provider_message_id: inboundEmailId,
        })

        if (insertErr) {
          console.error('Failed to insert inbound email:', insertErr)
          break
        }

        // Step 6: Log activity if lead matched
        if (matchedLead?.id && matchedLead.assigned_to) {
          await supabaseAdmin.from('activities').insert({
            lead_id: matchedLead.id,
            user_id: matchedLead.assigned_to,
            type: 'email_received',
            description: `Received email from ${fromEmail}: "${inboundSubject}"`,
            timestamp: event.created_at,
          })
        }

        console.log(`Inbound email processed: ${fromEmail} → ${toEmail}, thread: ${threadId}`)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return new Response('OK', { status: 200 })
  } catch (err) {
    console.error('email-events error:', err)
    return new Response('Internal error', { status: 500 })
  }
})
