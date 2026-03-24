import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api/campaigns';
import type { Campaign } from '@/types/crm';

export function useCampaigns() {
  const queryClient = useQueryClient();

  const { data: campaigns = [], isLoading, error } = useQuery({
    queryKey: ['campaigns'],
    queryFn: api.getCampaigns,
  });

  const addCampaignMutation = useMutation({
    mutationFn: (campaign: Omit<Campaign, 'id'>) =>
      api.createCampaign(campaign),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campaigns'] }),
  });

  const updateCampaignMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Campaign> }) =>
      api.updateCampaign(id, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campaigns'] }),
  });

  const cloneCampaignMutation = useMutation({
    mutationFn: (id: string) => api.cloneCampaign(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campaigns'] }),
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: (id: string) => api.deleteCampaign(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campaigns'] }),
  });

  return {
    campaigns,
    isLoading,
    error,
    addCampaign: (campaign: Omit<Campaign, 'id'>) =>
      addCampaignMutation.mutate(campaign),
    addCampaignAsync: (campaign: Omit<Campaign, 'id'>) =>
      addCampaignMutation.mutateAsync(campaign),
    updateCampaign: (id: string, updates: Partial<Campaign>) =>
      updateCampaignMutation.mutateAsync({ id, updates }),
    cloneCampaign: (id: string) => cloneCampaignMutation.mutateAsync(id),
    deleteCampaign: (id: string) => deleteCampaignMutation.mutateAsync(id),
  };
}
