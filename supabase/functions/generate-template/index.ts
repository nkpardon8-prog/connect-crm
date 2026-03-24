import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY')
    if (!OPENROUTER_API_KEY) {
      return new Response(JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { mode, prompt, existingSubject, existingBody } = await req.json()

    let systemPrompt: string
    let userPrompt: string
    let temperature: number

    if (mode === 'cleanup') {
      systemPrompt = `You are a world-class sales email copywriting expert. The user will provide an existing email template. Your job is to significantly improve it:
- Make it more professional, concise, and persuasive
- Vary sentence structure — avoid generic openers like "I hope this finds you well"
- Use compelling hooks that create curiosity or highlight pain points
- Keep merge fields like {{firstName}} and {{company}} intact
- Keep {{unsubscribeLink}} if present
- Subject line should be under 80 characters, attention-grabbing
- Body should be 3-5 sentences, conversational but professional
Return a JSON object with "subject" and "body" fields.`
      userPrompt = `Please improve this email template:\n\nSubject: ${existingSubject}\n\nBody:\n${existingBody}`
      temperature = 0.5
    } else {
      systemPrompt = `You are a world-class sales email copywriting expert. Generate a professional outreach email template based on the user's description.
- Use merge fields {{firstName}} and {{company}} where appropriate
- Subject line: under 80 characters, compelling, creates curiosity
- Body: 3-5 sentences, professional but conversational
- Include a clear call-to-action (e.g., "Would you be open to a quick call?")
- Vary your approach — don't always start with "I noticed..." or "I came across..."
- End with {{unsubscribeLink}} on a new line
Return a JSON object with "subject" and "body" fields.`
      userPrompt = prompt || 'Write a general cold outreach email for a B2B SaaS product'
      temperature = 0.7
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'X-Title': 'IntegrateAPI CRM',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4.1-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'email_template',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                subject: { type: 'string' },
                body: { type: 'string' },
              },
              required: ['subject', 'body'],
              additionalProperties: false,
            },
          },
        },
        temperature,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('OpenRouter error:', response.status, errorBody)
      return new Response(JSON.stringify({ error: 'AI generation failed' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const data = await response.json()
    if (!data.choices?.length || !data.choices[0].message?.content) {
      return new Response(JSON.stringify({ error: 'No response from AI' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const content = JSON.parse(data.choices[0].message.content)
    return new Response(JSON.stringify(content), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('generate-template error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
