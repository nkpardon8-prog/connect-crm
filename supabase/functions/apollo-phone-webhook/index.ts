import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const payload = await req.json()
    const people = payload.people || []

    console.log(`Apollo phone webhook received: ${people.length} people`)

    let updated = 0
    for (const person of people) {
      const apolloId = person.id
      const phoneNumbers = person.phone_numbers || []

      if (!apolloId || phoneNumbers.length === 0) continue

      // Get the best phone number (prefer sanitized, valid ones)
      const validPhone = phoneNumbers.find((p: Record<string, unknown>) =>
        p.sanitized_number && p.status_cd !== 'invalid_number'
      )
      const bestPhone = validPhone || phoneNumbers[0]
      const phone = (bestPhone?.sanitized_number || bestPhone?.raw_number || '') as string

      if (!phone) continue

      // Update the lead by apollo_id
      const { data, error } = await supabaseAdmin.from('leads')
        .update({ phone })
        .eq('apollo_id', apolloId)
        .select('id')

      if (error) {
        console.error(`Failed to update phone for apollo_id ${apolloId}:`, error)
      } else if (data && data.length > 0) {
        updated++
        console.log(`Updated phone for lead ${data[0].id}: ${phone}`)
      } else {
        console.log(`No lead found for apollo_id ${apolloId}`)
      }
    }

    console.log(`Phone webhook complete: ${updated} of ${people.length} leads updated`)
    return new Response(JSON.stringify({ updated, total: people.length }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('apollo-phone-webhook error:', err)
    return new Response('Internal error', { status: 500 })
  }
})
