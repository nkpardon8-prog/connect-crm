import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CRMContext } from '../client.js'

interface ResendSendResponse {
  id: string
}

async function sendViaResend(
  apiKey: string,
  payload: Record<string, unknown>
): Promise<ResendSendResponse> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Resend error ${response.status}: ${text}`)
  }

  return response.json() as Promise<ResendSendResponse>
}

export function registerSendEmailTools(server: McpServer, ctx: CRMContext): void {
  // 1. compose-email
  server.tool(
    'compose-email',
    'Compose and send a new email via Resend, then record it in the database.',
    {
      to: z.string().email().describe('Recipient email address'),
      subject: z.string().describe('Email subject'),
      body: z.string().describe('Email body (plain text or HTML)'),
      leadId: z.string().optional().describe('Associate this email with a lead ID'),
    },
    async ({ to, subject, body, leadId }) => {
      const from = `${ctx.userName} <${ctx.emailPrefix}@integrateapi.ai>`
      const threadId = crypto.randomUUID()

      let providerMessageId: string | undefined
      try {
        const result = await sendViaResend(ctx.resendApiKey, {
          from,
          to,
          subject,
          html: body,
        })
        providerMessageId = result.id
      } catch (err) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to send email: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
        }
      }

      const record: Record<string, unknown> = {
        user_id: ctx.userId,
        from,
        to,
        subject,
        body,
        direction: 'outbound',
        read: true,
        thread_id: threadId,
        sent_at: new Date().toISOString(),
        provider_message_id: providerMessageId,
      }

      if (leadId !== undefined) record.lead_id = leadId

      const { data, error } = await ctx.supabase
        .from('emails')
        .insert(record)
        .select()
        .single()

      if (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Email sent (provider id: ${providerMessageId}) but DB insert failed: ${error.message}`,
            },
          ],
        }
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      }
    }
  )

  // 2. reply-to-email
  server.tool(
    'reply-to-email',
    'Reply to an existing email thread via Resend, with proper threading headers.',
    {
      threadId: z.string().describe('Thread ID to reply within'),
      replyToId: z.string().describe('ID of the specific email being replied to'),
      body: z.string().describe('Reply body (plain text or HTML)'),
    },
    async ({ threadId, replyToId, body }) => {
      // Look up the original email to reply to
      const { data: original, error: originalError } = await ctx.supabase
        .from('emails')
        .select('*')
        .eq('id', replyToId)
        .maybeSingle()

      if (originalError) {
        return {
          content: [{ type: 'text' as const, text: `Error looking up original email: ${originalError.message}` }],
        }
      }

      if (!original) {
        return {
          content: [{ type: 'text' as const, text: `Email ${replyToId} not found` }],
        }
      }

      const orig = original as Record<string, unknown>

      // Determine recipient: if original was inbound, reply to its sender; if outbound, reply to its recipient
      const recipient =
        orig.direction === 'inbound'
          ? (orig.from as string)
          : (orig.to as string)

      // Build threading headers from all emails in thread
      const { data: threadEmails } = await ctx.supabase
        .from('emails')
        .select('provider_message_id')
        .eq('thread_id', threadId)
        .not('provider_message_id', 'is', null)
        .order('sent_at', { ascending: true })

      const messageIds = (threadEmails ?? [])
        .map((e) => (e as Record<string, unknown>).provider_message_id as string)
        .filter(Boolean)

      const latestMessageId = messageIds[messageIds.length - 1]

      const from = `${ctx.userName} <${ctx.emailPrefix}@integrateapi.ai>`
      const subject =
        typeof orig.subject === 'string' && !orig.subject.startsWith('Re:')
          ? `Re: ${orig.subject}`
          : (orig.subject as string) ?? ''

      const resendPayload: Record<string, unknown> = {
        from,
        to: recipient,
        subject,
        html: body,
      }

      if (latestMessageId) {
        resendPayload.headers = {
          'In-Reply-To': latestMessageId,
          References: messageIds.join(' '),
        }
      }

      let providerMessageId: string | undefined
      try {
        const result = await sendViaResend(ctx.resendApiKey, resendPayload)
        providerMessageId = result.id
      } catch (err) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to send reply: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
        }
      }

      const record: Record<string, unknown> = {
        user_id: ctx.userId,
        from,
        to: recipient,
        subject,
        body,
        direction: 'outbound',
        read: true,
        thread_id: threadId,
        reply_to_id: replyToId,
        sent_at: new Date().toISOString(),
        provider_message_id: providerMessageId,
      }

      if (orig.lead_id) record.lead_id = orig.lead_id

      const { data, error } = await ctx.supabase
        .from('emails')
        .insert(record)
        .select()
        .single()

      if (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Reply sent (provider id: ${providerMessageId}) but DB insert failed: ${error.message}`,
            },
          ],
        }
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      }
    }
  )
}
