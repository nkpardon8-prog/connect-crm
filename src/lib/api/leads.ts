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

export async function createLead(lead: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>): Promise<Lead> {
  const snaked = toSnakeCase(lead as unknown as Record<string, unknown>);
  const { data, error } = await supabase
    .from('leads')
    .insert(snaked)
    .select()
    .single();

  if (error) throw error;
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

export async function createLeads(
  leads: Omit<Lead, 'id' | 'createdAt'>[]
): Promise<Lead[]> {
  const snaked = leads.map(l => toSnakeCase(l as unknown as Record<string, unknown>));
  const { data, error } = await supabase
    .from('leads')
    .insert(snaked)
    .select();

  if (error) throw error;
  return transformRows<Lead>(data || []);
}

export async function deleteLead(id: string): Promise<void> {
  const { error } = await supabase
    .from('leads')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}
