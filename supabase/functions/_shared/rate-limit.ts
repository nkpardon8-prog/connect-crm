// REQUIRES service-role client — RLS on rate_limits table is deny-all.
// Per-user, per-action sliding-window rate limiter. Fails CLOSED on infra error:
// returning 429 beats burning unbounded LLM tokens during an outage or token leak.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface RateLimitResult {
  ok: boolean
  retryAfterSeconds?: number
  reason?: string
}

export async function checkRateLimit(
  supabaseAdmin: SupabaseClient,
  userId: string,
  action: string,
  windowSeconds: number,
  maxCalls: number
): Promise<RateLimitResult> {
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString()

  // Count calls in window
  const { count, error: countErr } = await supabaseAdmin
    .from('rate_limits')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('action', action)
    .gte('called_at', since)

  if (countErr) {
    // Fail CLOSED — this endpoint bounds LLM cost. Failing open during a token leak defeats the purpose.
    console.error('Rate limit check failed (failing closed):', countErr)
    return { ok: false, retryAfterSeconds: 60, reason: 'Rate limit infrastructure unavailable — try again shortly' }
  }

  if ((count ?? 0) >= maxCalls) {
    // Find earliest call in window to compute retry-after — use maybeSingle to avoid PGRST116 if a concurrent cleanup races
    const { data: oldest } = await supabaseAdmin
      .from('rate_limits')
      .select('called_at')
      .eq('user_id', userId)
      .eq('action', action)
      .gte('called_at', since)
      .order('called_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    const oldestMs = oldest?.called_at ? new Date(oldest.called_at as string).getTime() : Date.now()
    const retryAfterSeconds = Math.max(1, Math.ceil((oldestMs + windowSeconds * 1000 - Date.now()) / 1000))
    return { ok: false, retryAfterSeconds, reason: `Rate limited — try again in ${retryAfterSeconds}s` }
  }

  // Record this call. Awaited so we know whether it landed; if it errors we fail closed too.
  const { error: insertErr } = await supabaseAdmin.from('rate_limits').insert({ user_id: userId, action })
  if (insertErr) {
    console.error('Rate limit insert failed (failing closed):', insertErr)
    return { ok: false, retryAfterSeconds: 60, reason: 'Rate limit infrastructure unavailable — try again shortly' }
  }
  // Note: count + insert is not atomic. Under N concurrent edge invocations all N can pass the
  // count check before any insert lands. Worst-case burst ~ maxCalls + N calls per window. At Sonnet
  // 4.6 ~$0.05/call this caps practical damage well under $1/min/user. Acceptable for v1; future
  // fix is a Postgres function with row-level locking.

  return { ok: true }
}
