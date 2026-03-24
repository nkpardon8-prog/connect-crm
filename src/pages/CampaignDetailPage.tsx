import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCampaigns } from '@/hooks/use-campaigns';
import { useEmails } from '@/hooks/use-emails';
import { useLeads } from '@/hooks/use-leads';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Copy, PauseCircle, PlayCircle } from 'lucide-react';
import { toast } from 'sonner';
import CampaignAnalytics from '@/components/campaigns/CampaignAnalytics';

const statusColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  active: 'bg-blue-100 text-blue-700',
  paused: 'bg-amber-100 text-amber-700',
  completed: 'bg-emerald-100 text-emerald-700',
  scheduled: 'bg-violet-100 text-violet-700',
};

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { campaigns, cloneCampaign, updateCampaign } = useCampaigns();
  const { emails } = useEmails();
  const { leads } = useLeads();
  const queryClient = useQueryClient();

  const campaign = campaigns.find(c => c.id === id);
  const campaignEmails = emails.filter(e => e.campaignId === id && e.direction === 'outbound');

  // Get enrollments for this campaign
  const [enrollments, setEnrollments] = useState<Array<{ leadId: string | null; status: string; currentStep: number }>>([]);
  useEffect(() => {
    if (!id) return;
    supabase.from('campaign_enrollments')
      .select('lead_id, status, current_step')
      .eq('campaign_id', id)
      .then(({ data }) => {
        if (data) setEnrollments(data.map(e => ({ leadId: e.lead_id, status: e.status, currentStep: e.current_step })));
      });
  }, [id]);

  if (!campaign) {
    return (
      <div className="p-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/outreach')}
          className="gap-1.5 mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Outreach
        </Button>
        <p className="text-muted-foreground">Campaign not found.</p>
      </div>
    );
  }

  const stats = {
    sent: campaignEmails.length,
    opened: campaignEmails.filter(e => e.openedAt).length,
    clicked: campaignEmails.filter(e => e.clickedAt).length,
    bounced: campaignEmails.filter(e => e.bouncedAt).length,
    unsubscribed: 0, // TODO: count from unsubscribes table
  };

  const handleClone = async () => {
    try {
      await cloneCampaign(campaign.id);
      toast.success('Campaign cloned');
      navigate('/outreach');
    } catch {
      toast.error('Failed to clone');
    }
  };

  const handlePause = async () => {
    try {
      await updateCampaign(campaign.id, { status: 'paused' });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaign paused');
    } catch {
      toast.error('Failed to pause');
    }
  };

  const handleResume = async () => {
    try {
      await updateCampaign(campaign.id, { status: 'active' });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaign resumed');
    } catch {
      toast.error('Failed to resume');
    }
  };

  return (
    <div className="p-6 max-w-[1000px] space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/outreach')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {campaign.name || campaign.subject}
            </h1>
            <p className="text-xs text-muted-foreground">
              Sent {new Date(campaign.sentAt).toLocaleString()} &middot;{' '}
              {campaign.recipientIds.length} recipients
            </p>
            {campaign.scheduledAt && campaign.status === 'scheduled' && (
              <p className="text-xs text-muted-foreground">Scheduled for {new Date(campaign.scheduledAt).toLocaleString()}</p>
            )}
          </div>
          <Badge
            className={`text-xs ${statusColors[campaign.status] ?? statusColors.completed}`}
          >
            {campaign.status}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {(campaign.status === 'active' || campaign.status === 'scheduled') && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePause}>
              <PauseCircle className="h-3.5 w-3.5" /> Pause
            </Button>
          )}
          {campaign.status === 'paused' && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleResume}>
              <PlayCircle className="h-3.5 w-3.5" /> Resume
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleClone}>
            <Copy className="h-3.5 w-3.5" /> Clone Campaign
          </Button>
        </div>
      </div>

      <CampaignAnalytics {...stats} />

      <Card className="border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Email Content</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <p className="text-xs text-muted-foreground">Subject</p>
            <p className="text-sm font-medium">{campaign.subject}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Body</p>
            <p className="text-sm whitespace-pre-line text-foreground">{campaign.body}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Recipients ({campaignEmails.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Name</TableHead>
                <TableHead className="text-xs">Email</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Step</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaignEmails.map(email => {
                const lead = leads.find(l => l.id === email.leadId);
                const enrollment = enrollments.find(e => e.leadId === email.leadId);
                const emailStatus = email.bouncedAt
                  ? 'Bounced'
                  : email.clickedAt
                    ? 'Clicked'
                    : email.openedAt
                      ? 'Opened'
                      : 'Delivered';
                const statusColor = email.bouncedAt
                  ? 'text-red-500'
                  : email.clickedAt
                    ? 'text-blue-600'
                    : email.openedAt
                      ? 'text-emerald-600'
                      : 'text-muted-foreground';
                return (
                  <TableRow key={email.id}>
                    <TableCell className="text-xs">
                      {lead ? `${lead.firstName} ${lead.lastName}` : 'Unknown'}
                    </TableCell>
                    <TableCell className="text-xs">{email.to}</TableCell>
                    <TableCell className={`text-xs font-medium ${statusColor}`}>
                      {emailStatus}
                    </TableCell>
                    <TableCell className="text-xs">
                      {enrollment ? `Step ${enrollment.currentStep + 1}` : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
              {campaignEmails.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-xs text-muted-foreground py-4"
                  >
                    No emails sent yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
