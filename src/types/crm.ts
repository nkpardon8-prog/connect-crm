export type UserRole = 'admin' | 'employee';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
}

export type LeadStatus = 'cold' | 'lukewarm' | 'warm' | 'dead';

export interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobTitle: string;
  company: string;
  companySize: string;
  industry: string;
  location: string;
  status: LeadStatus;
  assignedTo: string; // user id
  createdAt: string;
  lastContactedAt: string | null;
  notes: string;
  tags: string[];
  linkedinUrl?: string;
}

export type ActivityType = 'call' | 'email_sent' | 'email_received' | 'note' | 'status_change' | 'meeting';

export interface Activity {
  id: string;
  leadId: string;
  userId: string;
  type: ActivityType;
  description: string;
  timestamp: string;
  metadata?: Record<string, string>;
}

export interface EmailMessage {
  id: string;
  leadId?: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  sentAt: string;
  read: boolean;
  direction: 'inbound' | 'outbound';
}

export type DealStage = 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';

export interface Deal {
  id: string;
  leadId: string;
  title: string;
  value: number;
  stage: DealStage;
  assignedTo: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailSequence {
  id: string;
  name: string;
  steps: SequenceStep[];
  createdBy: string;
  active: boolean;
}

export interface SequenceStep {
  id: string;
  order: number;
  subject: string;
  body: string;
  delayDays: number;
}

export interface AISuggestion {
  id: string;
  leadId: string;
  suggestion: string;
  priority: 'high' | 'medium' | 'low';
  createdAt: string;
  dismissed: boolean;
}
