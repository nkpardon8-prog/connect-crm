#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { initContext } from './client.js'
import { registerLeadTools } from './tools/leads.js'
import { registerEmailTools } from './tools/emails.js'
import { registerSendEmailTools } from './tools/send-email.js'
import { registerCampaignTools } from './tools/campaigns.js'
import { registerDealTools } from './tools/deals.js'
import { registerActivityTools } from './tools/activities.js'
import { registerApolloTools } from './tools/apollo.js'
import { registerTemplateTools } from './tools/templates.js'

async function main() {
  const ctx = await initContext()

  const server = new McpServer({
    name: 'connect-crm',
    version: '0.1.0',
  })

  registerLeadTools(server, ctx)
  registerEmailTools(server, ctx)
  registerSendEmailTools(server, ctx)
  registerCampaignTools(server, ctx)
  registerDealTools(server, ctx)
  registerActivityTools(server, ctx)
  registerApolloTools(server, ctx)
  registerTemplateTools(server, ctx)

  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((err) => {
  console.error('Failed to start CRM MCP server:', err)
  process.exit(1)
})
