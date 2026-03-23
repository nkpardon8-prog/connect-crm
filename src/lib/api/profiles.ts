import { supabase } from '@/lib/supabase';
import { transformRows, toCamelCase } from '@/lib/transforms';
import type { User } from '@/types/crm';

export async function getProfiles(): Promise<User[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('name');

  if (error) throw error;
  return transformRows<User>(data || []);
}

export async function getProfile(id: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return toCamelCase<User>(data);
}

export async function updateProfile(id: string, updates: Partial<Pick<User, 'name' | 'avatar' | 'sendingEmail'>>) {
  const { error } = await supabase
    .from('profiles')
    .update({
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.avatar !== undefined && { avatar: updates.avatar }),
      ...(updates.sendingEmail !== undefined && { sending_email: updates.sendingEmail }),
    })
    .eq('id', id);

  if (error) throw error;
}
