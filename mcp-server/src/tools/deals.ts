import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { CRMContext } from '../client.js'

export function registerDealTools(server: McpServer, ctx: CRMContext) {
  // 1. list-deals
  server.tool(
    'list-deals',
    'List all deals. Optionally filter by stage.',
    { stage: z.string().optional() },
    async ({ stage }) => {
      let query = ctx.supabase
        .from('deals')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      if (ctx.userRole !== 'admin') {
        query = query.eq('assigned_to', ctx.userId)
      }

      if (stage) {
        query = query.eq('stage', stage)
      }

      const { data, error } = await query
      if (error) throw new Error(error.message)

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      }
    }
  )

  // 2. get-deal
  server.tool(
    'get-deal',
    'Get a single deal by ID.',
    { id: z.string() },
    async ({ id }) => {
      let query = ctx.supabase
        .from('deals')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)

      if (ctx.userRole !== 'admin') {
        query = query.eq('assigned_to', ctx.userId)
      }

      const { data, error } = await query.single()
      if (error) throw new Error(error.message)

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      }
    }
  )

  // 3. create-deal
  server.tool(
    'create-deal',
    'Create a new deal linked to a lead.',
    {
      leadId: z.string(),
      title: z.string(),
      value: z.number(),
      stage: z.string().optional(),
    },
    async ({ leadId, title, value, stage }) => {
      const { data, error } = await ctx.supabase
        .from('deals')
        .insert({
          lead_id: leadId,
          title,
          value,
          stage: stage ?? 'new',
          assigned_to: ctx.userId,
        })
        .select()
        .single()

      if (error) throw new Error(error.message)
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      }
    }
  )

  // 4. update-deal
  server.tool(
    'update-deal',
    'Update a deal\'s stage, value, or title.',
    {
      id: z.string(),
      stage: z.string().optional(),
      value: z.number().optional(),
      title: z.string().optional(),
    },
    async ({ id, stage, value, title }) => {
      const updates: Record<string, string | number> = {}
      if (stage !== undefined) updates.stage = stage
      if (value !== undefined) updates.value = value
      if (title !== undefined) updates.title = title

      if (Object.keys(updates).length === 0) {
        return {
          content: [{ type: 'text' as const, text: 'No fields provided to update.' }],
        }
      }

      let query = ctx.supabase.from('deals').update(updates).eq('id', id)
      if (ctx.userRole !== 'admin') {
        query = query.eq('assigned_to', ctx.userId)
      }

      const { data, error } = await query.select().single()
      if (error) throw new Error(error.message)

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      }
    }
  )

  // 5. delete-deal
  server.tool(
    'delete-deal',
    'Permanently delete a deal.',
    { id: z.string() },
    async ({ id }) => {
      let query = ctx.supabase.from('deals').delete().eq('id', id)
      if (ctx.userRole !== 'admin') {
        query = query.eq('assigned_to', ctx.userId)
      }

      const { error } = await query
      if (error) throw new Error(error.message)

      return {
        content: [{ type: 'text' as const, text: `Deal ${id} deleted.` }],
      }
    }
  )
}
