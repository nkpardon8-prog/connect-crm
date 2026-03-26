import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { CRMContext } from '../client.js'

export function registerTemplateTools(server: McpServer, ctx: CRMContext) {
  // 1. list-templates
  server.tool(
    'list-templates',
    'List all campaign templates.',
    {},
    async () => {
      let query = ctx.supabase
        .from('campaign_templates')
        .select('*')
        .order('created_at', { ascending: false })

      if (ctx.userRole !== 'admin') {
        query = query.eq('created_by', ctx.userId)
      }

      const { data, error } = await query
      if (error) throw new Error(error.message)

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      }
    }
  )

  // 2. create-template
  server.tool(
    'create-template',
    'Create a new campaign template.',
    {
      name: z.string(),
      subject: z.string(),
      body: z.string(),
      tags: z.array(z.string()).optional(),
    },
    async ({ name, subject, body, tags }) => {
      const { data, error } = await ctx.supabase
        .from('campaign_templates')
        .insert({
          name,
          subject,
          body,
          created_by: ctx.userId,
          tags: tags ?? [],
        })
        .select()
        .single()

      if (error) throw new Error(error.message)
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      }
    }
  )

  // 3. delete-template
  server.tool(
    'delete-template',
    'Permanently delete a campaign template.',
    { id: z.string() },
    async ({ id }) => {
      let query = ctx.supabase.from('campaign_templates').delete().eq('id', id)

      if (ctx.userRole !== 'admin') {
        query = query.eq('created_by', ctx.userId)
      }

      const { error } = await query
      if (error) throw new Error(error.message)

      return {
        content: [{ type: 'text' as const, text: `Template ${id} deleted.` }],
      }
    }
  )
}
