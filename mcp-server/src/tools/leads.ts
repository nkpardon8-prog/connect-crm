import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CRMContext } from '../client.js'

export function registerLeadTools(server: McpServer, ctx: CRMContext): void {
  // 1. list-leads
  server.tool(
    'list-leads',
    'List leads with optional status filter and search. Admins see all; employees see only their assigned leads.',
    {
      status: z
        .enum(['cold', 'lukewarm', 'warm', 'dead'])
        .optional()
        .describe('Filter by lead status'),
      search: z.string().optional().describe('Filter by name, company, or email'),
      limit: z.number().int().positive().default(50).describe('Max results to return'),
    },
    async ({ status, search, limit }) => {
      let query = ctx.supabase
        .from('leads')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (ctx.userRole !== 'admin') {
        query = query.eq('assigned_to', ctx.userId)
      }

      if (status) {
        query = query.eq('status', status)
      }

      if (search) {
        query = query.or(
          `first_name.ilike.%${search}%,last_name.ilike.%${search}%,company.ilike.%${search}%,email.ilike.%${search}%`
        )
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

  // 2. get-lead
  server.tool(
    'get-lead',
    'Get a single lead by ID.',
    {
      id: z.string().describe('Lead ID'),
    },
    async ({ id }) => {
      let query = ctx.supabase
        .from('leads')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)

      if (ctx.userRole !== 'admin') {
        query = query.eq('assigned_to', ctx.userId)
      }

      const { data, error } = await query.maybeSingle()

      if (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      }

      if (!data) {
        return { content: [{ type: 'text' as const, text: 'Lead not found' }] }
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      }
    }
  )

  // 3. create-lead
  server.tool(
    'create-lead',
    'Create a new lead assigned to the current user.',
    {
      firstName: z.string().describe('First name'),
      lastName: z.string().describe('Last name'),
      email: z.string().email().describe('Email address'),
      company: z.string().describe('Company name'),
      phone: z.string().optional().describe('Phone number'),
      jobTitle: z.string().optional().describe('Job title'),
      industry: z.string().optional().describe('Industry'),
      location: z.string().optional().describe('Location'),
      status: z.string().optional().describe('Lead status'),
      tags: z.array(z.string()).optional().describe('Tags'),
    },
    async ({ firstName, lastName, email, company, phone, jobTitle, industry, location, status, tags }) => {
      const record: Record<string, unknown> = {
        first_name: firstName,
        last_name: lastName,
        email,
        company,
        assigned_to: ctx.userId,
      }

      if (phone !== undefined) record.phone = phone
      if (jobTitle !== undefined) record.job_title = jobTitle
      if (industry !== undefined) record.industry = industry
      if (location !== undefined) record.location = location
      if (status !== undefined) record.status = status
      if (tags !== undefined) record.tags = tags

      const { data, error } = await ctx.supabase
        .from('leads')
        .insert(record)
        .select()
        .single()

      if (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      }
    }
  )

  // 4. update-lead
  server.tool(
    'update-lead',
    'Update fields on an existing lead.',
    {
      id: z.string().describe('Lead ID'),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      company: z.string().optional(),
      jobTitle: z.string().optional(),
      industry: z.string().optional(),
      location: z.string().optional(),
      status: z.string().optional(),
      tags: z.array(z.string()).optional(),
      notes: z.string().optional(),
    },
    async ({ id, firstName, lastName, email, phone, company, jobTitle, industry, location, status, tags, notes }) => {
      const updates: Record<string, unknown> = {}

      if (firstName !== undefined) updates.first_name = firstName
      if (lastName !== undefined) updates.last_name = lastName
      if (email !== undefined) updates.email = email
      if (phone !== undefined) updates.phone = phone
      if (company !== undefined) updates.company = company
      if (jobTitle !== undefined) updates.job_title = jobTitle
      if (industry !== undefined) updates.industry = industry
      if (location !== undefined) updates.location = location
      if (status !== undefined) updates.status = status
      if (tags !== undefined) updates.tags = tags
      if (notes !== undefined) updates.notes = notes

      if (Object.keys(updates).length === 0) {
        return { content: [{ type: 'text' as const, text: 'No fields to update' }] }
      }

      let query = ctx.supabase.from('leads').update(updates).eq('id', id)

      if (ctx.userRole !== 'admin') {
        query = query.eq('assigned_to', ctx.userId)
      }

      const { data, error } = await query.select().single()

      if (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      }
    }
  )

  // 5. delete-lead
  server.tool(
    'delete-lead',
    'Soft-delete a lead by setting deleted_at.',
    {
      id: z.string().describe('Lead ID'),
    },
    async ({ id }) => {
      let query = ctx.supabase
        .from('leads')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)

      if (ctx.userRole !== 'admin') {
        query = query.eq('assigned_to', ctx.userId)
      }

      const { error } = await query

      if (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      }

      return {
        content: [{ type: 'text' as const, text: `Lead ${id} deleted` }],
      }
    }
  )

  // 6. search-leads
  server.tool(
    'search-leads',
    'Full-text search across first name, last name, company, and email.',
    {
      query: z.string().describe('Search query'),
      limit: z.number().int().positive().default(50).describe('Max results'),
    },
    async ({ query, limit }) => {
      let dbQuery = ctx.supabase
        .from('leads')
        .select('*')
        .is('deleted_at', null)
        .or(
          `first_name.ilike.%${query}%,last_name.ilike.%${query}%,company.ilike.%${query}%,email.ilike.%${query}%`
        )
        .order('created_at', { ascending: false })
        .limit(limit)

      if (ctx.userRole !== 'admin') {
        dbQuery = dbQuery.eq('assigned_to', ctx.userId)
      }

      const { data, error } = await dbQuery

      if (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data ?? [], null, 2) }],
      }
    }
  )

  // 7. import-leads
  server.tool(
    'import-leads',
    'Bulk import multiple leads at once, all assigned to the current user.',
    {
      leads: z
        .array(
          z.object({
            firstName: z.string(),
            lastName: z.string(),
            email: z.string().email(),
            company: z.string(),
            phone: z.string().optional(),
            jobTitle: z.string().optional(),
            industry: z.string().optional(),
            location: z.string().optional(),
          })
        )
        .describe('Array of leads to import'),
    },
    async ({ leads }) => {
      const records = leads.map((l) => {
        const record: Record<string, unknown> = {
          first_name: l.firstName,
          last_name: l.lastName,
          email: l.email,
          company: l.company,
          assigned_to: ctx.userId,
        }

        if (l.phone !== undefined) record.phone = l.phone
        if (l.jobTitle !== undefined) record.job_title = l.jobTitle
        if (l.industry !== undefined) record.industry = l.industry
        if (l.location !== undefined) record.location = l.location

        return record
      })

      const { data, error } = await ctx.supabase
        .from('leads')
        .insert(records)
        .select()

      if (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: `Imported ${data?.length ?? 0} leads.\n${JSON.stringify(data, null, 2)}`,
          },
        ],
      }
    }
  )

  // 8. list-lead-emails
  server.tool(
    'list-lead-emails',
    'List all emails associated with a specific lead.',
    {
      leadId: z.string().describe('Lead ID'),
    },
    async ({ leadId }) => {
      const { data, error } = await ctx.supabase
        .from('emails')
        .select('*')
        .eq('lead_id', leadId)
        .eq('user_id', ctx.userId)
        .order('sent_at', { ascending: false })

      if (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] }
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data ?? [], null, 2) }],
      }
    }
  )
}
