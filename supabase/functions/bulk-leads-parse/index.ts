import { corsHeaders } from '../_shared/cors.ts'
import { resolveUser } from '../_shared/auth.ts'
import { checkRateLimit } from '../_shared/rate-limit.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const MAX_INPUT_BYTES = 50_000
const MAX_OUTPUT_LEADS = 100
const RATE_LIMIT_WINDOW_S = 60
const RATE_LIMIT_MAX = 10

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  // 1. Auth
  let user
  try { user = await resolveUser(req.headers.get('Authorization'), supabaseAdmin) }
  catch (e) { return json({ error: (e as Error).message }, 401) }

  // 2. Validate input FIRST — don't burn a rate-limit slot on malformed/oversized payloads
  const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY')
  if (!OPENROUTER_API_KEY) return json({ error: 'OpenRouter API key not configured' }, 500)

  let body: unknown
  try { body = await req.json() }
  catch { return json({ error: 'Invalid JSON body' }, 400) }

  const text = (body as { text?: unknown })?.text
  if (!text || typeof text !== 'string' || !text.trim()) return json({ error: 'Text is required' }, 400)
  if (new TextEncoder().encode(text).byteLength > MAX_INPUT_BYTES) {
    return json({ error: 'Input too large — paste at most ~100 leads worth of data' }, 413)
  }

  // 3. Rate limit (fails CLOSED on infra error — bounds LLM cost). Runs AFTER input validation
  //    so UI typos / malformed pastes don't burn the user's 10 req/min budget.
  const rl = await checkRateLimit(supabaseAdmin, user.id, 'bulk-leads-parse', RATE_LIMIT_WINDOW_S, RATE_LIMIT_MAX)
  if (!rl.ok) return json({ error: rl.reason, retryAfterSeconds: rl.retryAfterSeconds }, 429)

  // 4. Call OpenRouter — strict JSON schema. ALL fields in `required` per OpenRouter strict-mode contract;
  //    model emits "" sentinels (per system prompt) for missing data; we strip post-parse.
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'X-Title': 'IntegrateAPI CRM',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4.6',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'parsed_leads',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['leads'],
            properties: {
              leads: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['firstName', 'lastName', 'email', 'phone', 'jobTitle', 'company', 'industry', 'location', 'linkedinUrl', 'notes'],
                  properties: {
                    firstName: { type: 'string' },
                    lastName: { type: 'string' },
                    email: { type: 'string' },
                    phone: { type: 'string' },
                    jobTitle: { type: 'string' },
                    company: { type: 'string' },
                    industry: { type: 'string' },
                    location: { type: 'string' },
                    linkedinUrl: { type: 'string' },
                    notes: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
      temperature: 0.2,
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    console.error('OpenRouter error:', response.status, errorBody)
    return json({ error: `LLM request failed (${response.status})` }, 502)
  }

  const data = await response.json()
  if (!data.choices?.length || !data.choices[0].message?.content) return json({ error: 'No response from LLM' }, 502)

  let parsed
  try { parsed = JSON.parse(data.choices[0].message.content) }
  catch { return json({ error: 'LLM returned invalid JSON' }, 502) }

  if (!Array.isArray(parsed.leads)) return json({ error: 'LLM returned wrong shape' }, 502)

  // Strip empty-string sentinels → undefined per field; require non-empty firstName AND (email OR phone).
  // Filtering email-AND-phone-empty here matches the DB CHECK constraint, so we never present a row
  // to the user that would fail at insert.
  const STRING_FIELDS = ['firstName', 'lastName', 'email', 'phone', 'jobTitle', 'company', 'industry', 'location', 'linkedinUrl', 'notes'] as const
  const cleaned = (parsed.leads as unknown[])
    .filter((l: unknown): l is Record<string, unknown> => !!l && typeof l === 'object')
    .map((l: Record<string, unknown>) => {
      const out: Record<string, string | undefined> = {}
      for (const k of STRING_FIELDS) {
        const v = l[k]
        out[k] = typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined
      }
      return out
    })
    .filter((l) =>
      typeof l.firstName === 'string' && l.firstName.length > 0 &&
      ((typeof l.email === 'string' && l.email.length > 0) || (typeof l.phone === 'string' && l.phone.length > 0))
    )

  // Silent truncate to MAX_OUTPUT_LEADS
  const truncated = cleaned.length > MAX_OUTPUT_LEADS
  const final = truncated ? cleaned.slice(0, MAX_OUTPUT_LEADS) : cleaned

  return json({ leads: final, truncated })
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

const SYSTEM_PROMPT = `You extract sales leads from messy unstructured text. Input may contain names, emails, phone numbers, job titles, company names, LinkedIn URLs, and other notes — possibly from copied LinkedIn profiles, email signatures, Slack threads, conference rosters, or notepads.

Rules:
- Output strictly the JSON shape requested. No prose, no markdown.
- One object per distinct person.
- EVERY field listed in the schema MUST be present in your output. For fields where you have no data, use the empty string "" (not null, not omitted).
- firstName is REQUIRED to be a NON-EMPTY string. If you cannot identify a first name for a candidate person, DO NOT include that lead at all.
- firstName/lastName: split full names sensibly. If only one name token, put it in firstName and use "" for lastName.
- email: lowercase. If you see multiple emails for one person, pick the work email; otherwise the first.
- phone: keep digits + +/() only; preserve country code if present.
- linkedinUrl: full URL including https://.
- notes: capture anything contextual that doesn't fit other fields, otherwise "".
- Skip non-person entries (company-only mentions, generic info@ addresses unless paired with a person).
- Maximum 100 leads. If input has more, return the first 100 in source order.`
