import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Lead, Activity, Deal, EmailMessage, AISuggestion, Campaign } from '@/types/crm';
import { mockLeads, mockActivities, mockDeals, mockEmails, mockSuggestions, mockCampaigns } from '@/data/mockData';

interface CRMContextType {
  leads: Lead[];
  activities: Activity[];
  deals: Deal[];
  emails: EmailMessage[];
  suggestions: AISuggestion[];
  campaigns: Campaign[];
  updateLead: (id: string, updates: Partial<Lead>) => void;
  addLead: (lead: Lead) => void;
  addLeads: (leads: Lead[]) => void;
  addActivity: (activity: Activity) => void;
  updateDeal: (id: string, updates: Partial<Deal>) => void;
  addEmail: (email: EmailMessage) => void;
  markEmailRead: (id: string, read?: boolean) => void;
  updateEmail: (id: string, updates: Partial<EmailMessage>) => void;
  dismissSuggestion: (id: string) => void;
  addCampaign: (campaign: Campaign) => void;
}

const CRMContext = createContext<CRMContextType | undefined>(undefined);

export function CRMProvider({ children }: { children: React.ReactNode }) {
  const [leads, setLeads] = useState<Lead[]>(mockLeads);
  const [activities, setActivities] = useState<Activity[]>(mockActivities);
  const [deals, setDeals] = useState<Deal[]>(mockDeals);
  const [emails, setEmails] = useState<EmailMessage[]>(mockEmails);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>(mockSuggestions);
  const [campaigns, setCampaigns] = useState<Campaign[]>(mockCampaigns);

  const updateLead = useCallback((id: string, updates: Partial<Lead>) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
  }, []);

  const addLead = useCallback((lead: Lead) => {
    setLeads(prev => [lead, ...prev]);
  }, []);

  const addLeads = useCallback((newLeads: Lead[]) => {
    setLeads(prev => [...newLeads, ...prev]);
  }, []);

  const addActivity = useCallback((activity: Activity) => {
    setActivities(prev => [activity, ...prev]);
  }, []);

  const updateDeal = useCallback((id: string, updates: Partial<Deal>) => {
    setDeals(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
  }, []);

  const addEmail = useCallback((email: EmailMessage) => {
    setEmails(prev => [email, ...prev]);
  }, []);

  const dismissSuggestion = useCallback((id: string) => {
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, dismissed: true } : s));
  }, []);

  const addCampaign = useCallback((campaign: Campaign) => {
    setCampaigns(prev => [campaign, ...prev]);
  }, []);

  return (
    <CRMContext.Provider value={{ leads, activities, deals, emails, suggestions, campaigns, updateLead, addLead, addLeads, addActivity, updateDeal, addEmail, dismissSuggestion, addCampaign }}>
      {children}
    </CRMContext.Provider>
  );
}

export function useCRM() {
  const ctx = useContext(CRMContext);
  if (!ctx) throw new Error('useCRM must be used within CRMProvider');
  return ctx;
}
