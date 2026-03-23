import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api/leads';
import type { Lead } from '@/types/crm';

export function useLeads() {
  const queryClient = useQueryClient();

  const { data: leads = [], isLoading, error } = useQuery({
    queryKey: ['leads'],
    queryFn: api.getLeads,
  });

  const updateLeadMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Lead> }) =>
      api.updateLead(id, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
  });

  const addLeadsMutation = useMutation({
    mutationFn: (newLeads: Omit<Lead, 'id' | 'createdAt'>[]) =>
      api.createLeads(newLeads),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
  });

  const deleteLeadMutation = useMutation({
    mutationFn: (id: string) => api.deleteLead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
  });

  return {
    leads,
    isLoading,
    error,
    updateLead: (id: string, updates: Partial<Lead>) =>
      updateLeadMutation.mutate({ id, updates }),
    addLeads: (newLeads: Omit<Lead, 'id' | 'createdAt'>[]) =>
      addLeadsMutation.mutate(newLeads),
    deleteLead: (id: string) => deleteLeadMutation.mutate(id),
  };
}
