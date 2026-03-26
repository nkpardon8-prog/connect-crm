import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { CRMContext } from '../client.js'

export function registerActivityTools(server: McpServer, ctx: CRMContext) {
  // 1. get-lead-timeline
  server.tool(
    'get-lead-timeline',
    'Get the full activity and email timeline for a lead, sorted by most recent first.',
    { leadId: z.string() },
    async ({ leadId }) => {
      let activitiesQuery = ctx.supabase
        .from('activities')
        .select('*')
        .eq('lead_id', leadId)
        .is('deleted_at', null)

      if (ctx.userRole !== 'admin') {
        activitiesQuery = activitiesQuery.eq('user_id', ctx.userId)
      }

      const [{ data: activities, error: activitiesError }, { data: emails, error: emailsError }] =
        await Promise.all([
          activitiesQuery,
          ctx.supabase
            .from('emails')
            .select('*')
            .eq('lead_id', leadId)
            .is('deleted_at', null),
        ])

      if (activitiesError) throw new Error(activitiesError.message)
      if (emailsError) throw new Error(emailsError.message)

      type TimelineItem =
        | { kind: 'activity'; sortKey: string; data: (typeof activities)[number] }
        | { kind: 'email'; sortKey: string; data: (typeof emails)[number] }

      const activityItems: TimelineItem[] = (activities ?? []).map((a) => ({
        kind: 'activity' as const,
        sortKey: a.timestamp,
        data: a,
      }))

      const emailItems: TimelineItem[] = (emails ?? []).map((e) => ({
        kind: 'email' as const,
        sortKey: e.sent_at,
        data: e,
      }))

      const timeline = [...activityItems, ...emailItems].sort((a, b) =>
        b.sortKey.localeCompare(a.sortKey)
      )

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(timeline, null, 2) }],
      }
    }
  )

  // 2. create-activity
  server.tool(
    'create-activity',
    'Log an activity (call, note, meeting, etc.) against a lead.',
    {
      leadId: z.string(),
      type: z.enum(['call', 'email_sent', 'email_received', 'note', 'status_change', 'meeting']),
      description: z.string(),
      metadata: z.record(z.string()).optional(),
    },
    async ({ leadId, type, description, metadata }) => {
      const { data, error } = await ctx.supabase
        .from('activities')
        .insert({
          lead_id: leadId,
          user_id: ctx.userId,
          type,
          description,
          timestamp: new Date().toISOString(),
          metadata: metadata ?? null,
        })
        .select()
        .single()

      if (error) throw new Error(error.message)
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      }
    }
  )
}
