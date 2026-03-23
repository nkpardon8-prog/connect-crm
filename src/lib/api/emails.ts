import { supabase } from '@/lib/supabase';
import { transformRows, toCamelCase, toSnakeCase } from '@/lib/transforms';
import type { EmailMessage } from '@/types/crm';

export async function getEmails(): Promise<EmailMessage[]> {
  const { data, error } = await supabase
    .from('emails')
    .select('*')
    .is('deleted_at', null)
    .order('sent_at', { ascending: false });

  if (error) throw error;
  return transformRows<EmailMessage>(data || []);
}

export async function getEmail(id: string): Promise<EmailMessage | null> {
  const { data, error } = await supabase
    .from('emails')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return toCamelCase<EmailMessage>(data);
}

export async function createEmail(
  email: Omit<EmailMessage, 'id' | 'createdAt' | 'updatedAt'>
): Promise<EmailMessage> {
  const snaked = toSnakeCase(email as unknown as Record<string, unknown>);
  const { data, error } = await supabase
    .from('emails')
    .insert(snaked)
    .select()
    .single();

  if (error) throw error;
  return toCamelCase<EmailMessage>(data);
}

export async function updateEmail(id: string, updates: Partial<EmailMessage>): Promise<void> {
  const { id: _id, ...rest } = updates;
  const snaked = toSnakeCase(rest as unknown as Record<string, unknown>);
  const { error } = await supabase
    .from('emails')
    .update(snaked)
    .eq('id', id);

  if (error) throw error;
}

export async function markEmailRead(id: string, read = true): Promise<void> {
  const { error } = await supabase
    .from('emails')
    .update({ read })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteEmail(id: string): Promise<void> {
  const { error } = await supabase
    .from('emails')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}
