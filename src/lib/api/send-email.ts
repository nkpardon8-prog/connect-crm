import { supabase } from '@/lib/supabase';

interface SendEmailRequest {
  leadId?: string;
  from: string;
  fromName: string;
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  replyToId?: string;
}

interface SendEmailResponse {
  emails: unknown[];
  count: number;
  failedCount: number;
}

export async function sendEmail(email: SendEmailRequest): Promise<SendEmailResponse> {
  const { data, error } = await supabase.functions.invoke('send-email', {
    body: { emails: [email] },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as SendEmailResponse;
}

export async function sendBulkEmails(emails: SendEmailRequest[]): Promise<SendEmailResponse> {
  const { data, error } = await supabase.functions.invoke('send-email', {
    body: { emails },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as SendEmailResponse;
}
