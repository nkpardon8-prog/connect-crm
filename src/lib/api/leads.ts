import { supabase } from '@/lib/supabase';
import { transformRows, toCamelCase, toSnakeCase } from '@/lib/transforms';
import type { Lead } from '@/types/crm';

export async function getLeads(): Promise<Lead[]> {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return transformRows<Lead>(data || []);
}

export async function getLead(id: string): Promise<Lead | null> {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return toCamelCase<Lead>(data);
}

export async function updateLead(id: string, updates: Partial<Lead>): Promise<void> {
  const { id: _id, createdAt: _ca, updatedAt: _ua, ...rest } = updates;
  const snaked = toSnakeCase(rest as unknown as Record<string, unknown>);
  const { error } = await supabase
    .from('leads')
    .update(snaked)
    .eq('id', id);

  if (error) throw error;
}

export interface CreateLeadsContext {
  currentUserId: string;
  isAdmin: boolean;
}

export async function createLeads(
  leads: Omit<Lead, 'id' | 'createdAt'>[],
  ctx: CreateLeadsContext,
): Promise<{ inserted: Lead[]; skippedDuplicates: string[] }> {
  if (leads.length === 0) return { inserted: [], skippedDuplicates: [] };

  // 1. Lowercase incoming emails
  const normalized = leads.map(l => ({
    ...l,
    email: typeof l.email === 'string' ? l.email.trim().toLowerCase() : l.email,
  }));

  // 2. In-batch dedup (same email pasted twice) — keep first occurrence
  const seen = new Set<string>();
  const skippedDuplicates: string[] = [];
  const inBatchDeduped = normalized.filter(l => {
    if (!l.email) return true;
    if (seen.has(l.email)) {
      skippedDuplicates.push(l.email);
      return false;
    }
    seen.add(l.email);
    return true;
  });

  // 3. Friendly pre-SELECT against existing rows (RLS-bound; the UNIQUE index is the real enforcer)
  const incomingEmails = inBatchDeduped.map(l => l.email).filter((e): e is string => !!e);
  let existingSet = new Set<string>();
  if (incomingEmails.length > 0) {
    const { data: dupRows } = await supabase
      .from('leads')
      .select('email')
      .is('deleted_at', null)
      .in('email', incomingEmails);
    existingSet = new Set((dupRows ?? []).map(r => (r.email ?? '').toLowerCase()));
  }

  const toInsert = inBatchDeduped.filter(l => {
    if (l.email && existingSet.has(l.email)) {
      skippedDuplicates.push(l.email);
      return false;
    }
    return true;
  });

  // 4. Force assigned_to for non-admins; treat empty-string assignedTo as null for admins
  const finalRows = toInsert.map(l => ({
    ...l,
    assignedTo: ctx.isAdmin ? (l.assignedTo || null) : ctx.currentUserId,
  }));

  if (finalRows.length === 0) {
    return { inserted: [], skippedDuplicates };
  }

  // 5. Insert. On 23505 (UNIQUE violation from RLS-blind / racing duplicate), parse the offending
  //    email from error.details, push to skippedDuplicates, retry without that row. Loop because
  //    Postgres aborts on the FIRST conflict — multi-conflict batches need multiple passes.
  //    Loop is bounded by `leads.length + 1` since each iteration removes at least one row.
  let rowsToInsert = finalRows;
  let inserted: Lead[] = [];
  const maxAttempts = leads.length + 1;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (rowsToInsert.length === 0) break;
    const snaked = rowsToInsert.map(l => {
      const s = toSnakeCase(l as unknown as Record<string, unknown>);
      // Normalize blank contact fields to null — keeps data clean and makes the
      // CHECK constraint (`leads_first_name_and_contact_required`) read cleanly.
      // Other columns retain whatever the caller passed; we don't know which other
      // columns are nullable in DB yet, so don't touch them defensively.
      if (s.email === '') s.email = null;
      if (s.phone === '') s.phone = null;
      return s;
    });
    const { data, error } = await supabase.from('leads').insert(snaked).select();
    if (!error) {
      inserted = transformRows<Lead>(data || []);
      break;
    }
    if (error.code !== '23505' || !/idx_leads_email_unique/.test(error.message ?? '')) throw error;
    // Parse offending email from "Key (lower(email))=(foo@bar.com) already exists."
    const match = (error.details ?? '').match(/\(lower\(email\)\)=\(([^)]+)\)/);
    if (!match) {
      // Couldn't parse — surface a useful error rather than infinite-loop
      throw new Error(`Insert failed with unique-violation but offending email could not be parsed: ${error.message}`);
    }
    const offending = match[1].toLowerCase();
    skippedDuplicates.push(offending);
    rowsToInsert = rowsToInsert.filter(l => l.email !== offending);
  }
  if (rowsToInsert.length > 0 && inserted.length === 0) {
    // Defensive: should be unreachable since maxAttempts >= rowsToInsert.length on entry
    // and every iteration shrinks rowsToInsert. Keeps a clear error path if invariant breaks.
    throw new Error('Too many duplicate-conflict retries; please try again');
  }

  return { inserted, skippedDuplicates };
}

export async function deleteLead(id: string): Promise<void> {
  const { error } = await supabase
    .from('leads')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

export async function incrementCallCount(leadIds: string[], amount = 1): Promise<void> {
  const { error } = await supabase.rpc('increment_call_count', { lead_ids: leadIds, amount });
  if (error) throw error;
}

export async function incrementEmailCount(leadIds: string[], amount = 1): Promise<void> {
  const { error } = await supabase.rpc('increment_email_count', { lead_ids: leadIds, amount });
  if (error) throw error;
}

export async function mergePhoneReveals(leads: Array<{ apolloId?: string | null; phone?: string }>): Promise<void> {
  const apolloIds = leads.map(l => l.apolloId).filter(Boolean) as string[]
  if (apolloIds.length === 0) return

  const { data: reveals } = await supabase
    .from('phone_reveals')
    .select('apollo_id, phone')
    .in('apollo_id', apolloIds)

  if (!reveals || reveals.length === 0) return

  const phoneMap = new Map(reveals.map(r => [r.apollo_id, r.phone]))
  for (const lead of leads) {
    if (lead.apolloId && !lead.phone && phoneMap.has(lead.apolloId)) {
      lead.phone = phoneMap.get(lead.apolloId)!
    }
  }
}
