import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { CRMContext } from '../client.js'

export function registerCampaignTools(server: McpServer, ctx: CRMContext) {
  // 1. list-campaigns
  server.tool(
    'list-campaigns',
    'List all campaigns. Optionally filter by status.',
    { status: z.string().optional() },
    async ({ status }) => {
      let query = ctx.supabase
        .from('campaigns')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      if (ctx.userRole !== 'admin') {
        query = query.eq('sent_by', ctx.userId)
      }

      if (status) {
        query = query.eq('status', status)
      }

      const { data, error } = await query
      if (error) throw new Error(error.message)

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      }
    }
  )

  // 2. get-campaign
  server.tool(
    'get-campaign',
    'Get a single campaign by ID, including enrollment counts.',
    { id: z.string() },
    async ({ id }) => {
      let campaignQuery = ctx.supabase
        .from('campaigns')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)

      if (ctx.userRole !== 'admin') {
        campaignQuery = campaignQuery.eq('sent_by', ctx.userId)
      }

      const { data: campaign, error: campaignError } = await campaignQuery.single()
      if (campaignError) throw new Error(campaignError.message)

      const { data: enrollments, error: enrollError } = await ctx.supabase
        .from('campaign_enrollments')
        .select('status')
        .eq('campaign_id', id)

      if (enrollError) throw new Error(enrollError.message)

      const enrollmentCounts: Record<string, number> = {}
      for (const e of enrollments ?? []) {
        enrollmentCounts[e.status] = (enrollmentCounts[e.status] ?? 0) + 1
      }

      const result = { ...campaign, enrollmentCounts }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      }
    }
  )

  // 3. create-campaign
  server.tool(
    'create-campaign',
    'Create a new campaign in draft status.',
    {
      name: z.string(),
      subject: z.string(),
      body: z.string(),
      scheduledAt: z.string().optional(),
      smartSend: z.boolean().optional(),
      sendSpacing: z.boolean().optional(),
      dailySendLimit: z.number().optional(),
    },
    async ({ name, subject, body, scheduledAt, smartSend, sendSpacing, dailySendLimit }) => {
      const { data, error } = await ctx.supabase
        .from('campaigns')
        .insert({
          name,
          subject,
          body,
          sent_by: ctx.userId,
          status: 'draft',
          recipient_ids: [],
          scheduled_at: scheduledAt ?? null,
          smart_send: smartSend ?? false,
          send_spacing: sendSpacing ?? null,
          daily_send_limit: dailySendLimit ?? null,
        })
        .select()
        .single()

      if (error) throw new Error(error.message)
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      }
    }
  )

  // 4. launch-campaign
  server.tool(
    'launch-campaign',
    'Launch a campaign. Provide scheduledAt to schedule it, otherwise activates immediately.',
    { id: z.string(), scheduledAt: z.string().optional() },
    async ({ id, scheduledAt }) => {
      const newStatus = scheduledAt ? 'scheduled' : 'active'
      const now = new Date().toISOString()

      const { data, error } = await ctx.supabase
        .from('campaigns')
        .update({
          status: newStatus,
          scheduled_at: scheduledAt ?? null,
          sent_at: now,
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw new Error(error.message)
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      }
    }
  )

  // 5. pause-campaign
  server.tool(
    'pause-campaign',
    'Pause an active campaign.',
    { id: z.string() },
    async ({ id }) => {
      const { data, error } = await ctx.supabase
        .from('campaigns')
        .update({ status: 'paused' })
        .eq('id', id)
        .select()
        .single()

      if (error) throw new Error(error.message)
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      }
    }
  )

  // 6. resume-campaign
  server.tool(
    'resume-campaign',
    'Resume a paused campaign.',
    { id: z.string() },
    async ({ id }) => {
      const { data, error } = await ctx.supabase
        .from('campaigns')
        .update({ status: 'active' })
        .eq('id', id)
        .select()
        .single()

      if (error) throw new Error(error.message)
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      }
    }
  )

  // 7. edit-campaign-content
  server.tool(
    'edit-campaign-content',
    'Update the subject and/or body of a campaign.',
    {
      id: z.string(),
      subject: z.string().optional(),
      body: z.string().optional(),
    },
    async ({ id, subject, body }) => {
      const updates: Record<string, string> = {}
      if (subject !== undefined) updates.subject = subject
      if (body !== undefined) updates.body = body

      if (Object.keys(updates).length === 0) {
        return {
          content: [{ type: 'text' as const, text: 'No fields provided to update.' }],
        }
      }

      const { data, error } = await ctx.supabase
        .from('campaigns')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw new Error(error.message)
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      }
    }
  )

  // 8. enroll-leads
  server.tool(
    'enroll-leads',
    'Enroll leads into a campaign by their IDs.',
    { campaignId: z.string(), leadIds: z.array(z.string()) },
    async ({ campaignId, leadIds }) => {
      const { data: leads, error: leadsError } = await ctx.supabase
        .from('leads')
        .select('id, email')
        .in('id', leadIds)

      if (leadsError) throw new Error(leadsError.message)
      if (!leads || leads.length === 0) {
        return {
          content: [{ type: 'text' as const, text: 'No matching leads found.' }],
        }
      }

      const enrollmentRows = leads.map((lead) => ({
        campaign_id: campaignId,
        lead_id: lead.id,
        email: lead.email,
        status: 'pending',
        current_step: 0,
      }))

      const { error: enrollError } = await ctx.supabase
        .from('campaign_enrollments')
        .insert(enrollmentRows)

      if (enrollError) throw new Error(enrollError.message)

      const enrolledIds = leads.map((l) => l.id)
      const { data: campaign, error: campaignError } = await ctx.supabase
        .from('campaigns')
        .select('recipient_ids')
        .eq('id', campaignId)
        .single()

      if (campaignError) throw new Error(campaignError.message)

      const existingIds: string[] = campaign.recipient_ids ?? []
      const mergedIds = Array.from(new Set([...existingIds, ...enrolledIds]))

      const { error: updateError } = await ctx.supabase
        .from('campaigns')
        .update({ recipient_ids: mergedIds })
        .eq('id', campaignId)

      if (updateError) throw new Error(updateError.message)

      return {
        content: [
          {
            type: 'text' as const,
            text: `Enrolled ${leads.length} lead(s) into campaign ${campaignId}.`,
          },
        ],
      }
    }
  )

  // 9. get-campaign-stats
  server.tool(
    'get-campaign-stats',
    'Get enrollment and email engagement stats for a campaign.',
    { id: z.string() },
    async ({ id }) => {
      const { data: enrollments, error: enrollError } = await ctx.supabase
        .from('campaign_enrollments')
        .select('status')
        .eq('campaign_id', id)

      if (enrollError) throw new Error(enrollError.message)

      const enrollmentCounts: Record<string, number> = {}
      for (const e of enrollments ?? []) {
        enrollmentCounts[e.status] = (enrollmentCounts[e.status] ?? 0) + 1
      }

      const { data: emails, error: emailError } = await ctx.supabase
        .from('emails')
        .select('opened_at, clicked_at, bounced_at')
        .eq('campaign_id', id)
        .eq('direction', 'outbound')

      if (emailError) throw new Error(emailError.message)

      const emailStats = {
        sent: emails?.length ?? 0,
        opened: emails?.filter((e) => e.opened_at).length ?? 0,
        clicked: emails?.filter((e) => e.clicked_at).length ?? 0,
        bounced: emails?.filter((e) => e.bounced_at).length ?? 0,
      }

      const result = { enrollmentCounts, emailStats }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      }
    }
  )

  // 10. create-sequence
  server.tool(
    'create-sequence',
    'Create a campaign sequence with ordered steps.',
    {
      steps: z.array(
        z.object({
          subject: z.string(),
          body: z.string(),
          delayDays: z.number(),
        })
      ),
    },
    async ({ steps }) => {
      const { data: sequence, error: seqError } = await ctx.supabase
        .from('campaign_sequences')
        .insert({
          name: `Sequence ${Date.now()}`,
          created_by: ctx.userId,
        })
        .select()
        .single()

      if (seqError) throw new Error(seqError.message)

      const stepRows = steps.map((s, i) => ({
        sequence_id: sequence.id,
        order: i,
        subject: s.subject,
        body: s.body,
        delay_days: s.delayDays,
      }))

      const { error: stepsError } = await ctx.supabase
        .from('campaign_steps')
        .insert(stepRows)

      if (stepsError) throw new Error(stepsError.message)

      const result = { sequenceId: sequence.id, stepsCreated: steps.length }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      }
    }
  )
}
