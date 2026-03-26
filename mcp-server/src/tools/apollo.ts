import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { CRMContext } from '../client.js'

export function registerApolloTools(server: McpServer, ctx: CRMContext) {
  // 1. search-apollo
  server.tool(
    'search-apollo',
    'Search Apollo for people matching your criteria. WARNING: Uses Apollo credits (1 per enriched contact). Use sparingly.',
    {
      prompt: z.string(),
      perPage: z.number().default(10),
    },
    async ({ prompt, perPage }) => {
      const { data: result, error } = await ctx.supabase.functions.invoke('apollo-search', {
        body: { prompt, perPage },
      })

      if (error) throw new Error(error.message)

      await ctx.supabase.from('apollo_usage').insert({
        user_id: ctx.userId,
        action: 'search_people',
        credits_used: (result as { creditsUsed?: number }).creditsUsed ?? 0,
        search_count: 1,
        results_returned: (result as { leads?: unknown[] }).leads?.length ?? 0,
        prompt,
      })

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      }
    }
  )

  // 2. search-apollo-companies
  server.tool(
    'search-apollo-companies',
    'Search Apollo for companies. WARNING: Uses Apollo credits.',
    {
      prompt: z.string(),
      perPage: z.number().default(10),
    },
    async ({ prompt, perPage }) => {
      const companyPrompt = `companies: ${prompt}`

      const { data: result, error } = await ctx.supabase.functions.invoke('apollo-search', {
        body: { prompt: companyPrompt, perPage },
      })

      if (error) throw new Error(error.message)

      await ctx.supabase.from('apollo_usage').insert({
        user_id: ctx.userId,
        action: 'search_companies',
        credits_used: (result as { creditsUsed?: number }).creditsUsed ?? 0,
        search_count: 1,
        results_returned:
          (result as { leads?: unknown[]; companies?: unknown[] }).companies?.length ??
          (result as { leads?: unknown[] }).leads?.length ??
          0,
        prompt: companyPrompt,
      })

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      }
    }
  )
}
