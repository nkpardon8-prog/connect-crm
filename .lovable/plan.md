

## AI-Powered Campaign Composer — Build Plan

Add a chat-based AI assistant to the Campaigns tab that lets users describe their campaign in natural language and have it auto-fill recipients (via filters), subject line, and email body.

### How it works

A toggle or button at the top of the Campaigns tab switches between **Manual** mode (current flow) and **AI Assistant** mode. In AI mode:

1. **Chat interface** — User describes their campaign naturally, e.g. "Send a cold outreach email to all SaaS leads introducing our API integration platform"
2. **Mock AI response** — The bot parses keywords from the prompt and:
   - Auto-selects recipients by matching industry and status keywords (e.g. "SaaS" → industry filter, "cold" → status filter)
   - Generates a subject line and body with `{{firstName}}` and `{{company}}` merge fields
3. **Preview & edit** — The auto-filled campaign appears in an editable form below the chat, showing selected recipients, subject, and body
4. **User can refine** — Send another message like "make it shorter" or "also include cloud leads" and the fields update
5. **Send** — Same send flow as current manual campaigns

### Technical changes

| File | Change |
|------|--------|
| `src/pages/OutreachPage.tsx` | Add AI chat UI within campaigns tab — chat messages state, input bar, mock AI logic that parses prompts for industry/status keywords and generates email content. Auto-applies filters and fills subject/body fields. Adds a "AI Compose" / "Manual" toggle. |

No new files needed. The mock AI logic lives inline — it pattern-matches keywords from the user's message against available industries and statuses, selects matching leads, and generates template email content. This is structured to later replace the mock logic with a real Lovable AI call.

### Mock AI behavior

- Scans prompt for industry keywords (matched against `leads.map(l => l.industry)`)
- Scans for status keywords ("cold", "warm", "lukewarm")
- Auto-selects matching leads and sets filters
- Generates a contextual subject + body using the prompt topic
- If no keywords match, selects all leads and asks for clarification

