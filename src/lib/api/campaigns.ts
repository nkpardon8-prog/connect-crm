import { supabase } from '@/lib/supabase';
import { transformRows, toCamelCase, toSnakeCase } from '@/lib/transforms';
import type { Campaign } from '@/types/crm';

export async function getCampaigns(): Promise<Campaign[]> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .is('deleted_at', null)
    .order('sent_at', { ascending: false });

  if (error) throw error;
  return transformRows<Campaign>(data || []);
}

export async function createCampaign(
  campaign: Omit<Campaign, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Campaign> {
  const snaked = toSnakeCase(campaign as unknown as Record<string, unknown>);
  const { data, error } = await supabase
    .from('campaigns')
    .insert(snaked)
    .select()
    .single();

  if (error) throw error;
  return toCamelCase<Campaign>(data);
}
