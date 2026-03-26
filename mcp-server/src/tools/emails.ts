import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CRMContext } from '../client.js'

export function registerEmailTools(server: McpServer, ctx: CRMContext): void {
  // 1. list-emails
  server.tool(
    'list-emails',
    'List emails by folder (inbox/sent/all). Admins see all; employees see only their own.',
    {
      folder: z
        .enum(['inbox', 'sent', 'all'])
        .optional()
        .describe('inbox = inbound, sent = outbound, all = both'),
      limit: z.number().int().positive().default(50).describe('Max results'),
    },
    async ({ folder, limit }) => {
      let query = ctx.supabase
        .from('emails')
        .select('*')
        .is('deleted_at', null)
        .order('sent_at', { ascending: false })
        .limit(limit)

      if (ctx.userRole !== 'admin') {
        query = query.eq('user_id', ctx.userId)
      }

      if (folder === 'inbox') {
        query = query.eq('direction', 'inbound')
      } else if (folder === 'sent') {
        query = query.eq('direction', 'outbound')
      }

      const { data, error } = await query

      if (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data ?? [], null, 2) }],
      }
    }
  )

  // 2. get-email
  server.tool(
    'get-email',
    'Get a single email by ID.',
    {
      id: z.string().describe('Email ID'),
    },
    async ({ id }) => {
      let query = ctx.supabase.from('emails').select('*').eq('id', id)

      if (ctx.userRole !== 'admin') {
        query = query.eq('user_id', ctx.userId)
      }

      const { data, error } = await query.maybeSingle()

      if (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      }

      if (!data) {
        return { content: [{ type: 'text' as const, text: 'Email not found' }] }
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      }
    }
  )

  // 3. get-thread
  server.tool(
    'get-thread',
    'Get all emails in a thread, ordered oldest to newest.',
    {
      threadId: z.string().describe('Thread ID'),
    },
    async ({ threadId }) => {
      let query = ctx.supabase
        .from('emails')
        .select('*')
        .eq('thread_id', threadId)
        .order('sent_at', { ascending: true })

      if (ctx.userRole !== 'admin') {
        query = query.eq('user_id', ctx.userId)
      }

      const { data, error } = await query

      if (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data ?? [], null, 2) }],
      }
    }
  )

  // 4. mark-email-read
  server.tool(
    'mark-email-read',
    'Mark an email as read or unread.',
    {
      id: z.string().describe('Email ID'),
      read: z.boolean().default(true).describe('True to mark read, false to mark unread'),
    },
    async ({ id, read }) => {
      let query = ctx.supabase.from('emails').update({ read }).eq('id', id)

      if (ctx.userRole !== 'admin') {
        query = query.eq('user_id', ctx.userId)
      }

      const { error } = await query

      if (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      }

      return {
        content: [{ type: 'text' as const, text: `Email ${id} marked as ${read ? 'read' : 'unread'}` }],
      }
    }
  )

  // 5. delete-email
  server.tool(
    'delete-email',
    'Soft-delete an email by setting deleted_at.',
    {
      id: z.string().describe('Email ID'),
    },
    async ({ id }) => {
      let query = ctx.supabase
        .from('emails')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)

      if (ctx.userRole !== 'admin') {
        query = query.eq('user_id', ctx.userId)
      }

      const { error } = await query

      if (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      }

      return {
        content: [{ type: 'text' as const, text: `Email ${id} deleted` }],
      }
    }
  )

  // 6. list-threads
  server.tool(
    'list-threads',
    'List email threads, returning the most recent email per thread.',
    {
      limit: z.number().int().positive().default(30).describe('Max threads to return'),
    },
    async ({ limit }) => {
      let query = ctx.supabase
        .from('emails')
        .select('*')
        .is('deleted_at', null)
        .not('thread_id', 'is', null)
        .order('sent_at', { ascending: false })

      if (ctx.userRole !== 'admin') {
        query = query.eq('user_id', ctx.userId)
      }

      const { data, error } = await query

      if (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      }

      // Group by thread_id in code, keep only the latest per thread
      const seenThreads = new Set<string>()
      const threads: unknown[] = []

      for (const email of data ?? []) {
        const threadId = (email as Record<string, unknown>).thread_id as string
        if (!seenThreads.has(threadId)) {
          seenThreads.add(threadId)
          threads.push(email)
          if (threads.length >= limit) break
        }
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(threads, null, 2) }],
      }
    }
  )
}
