import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLeads } from '@/hooks/use-leads';
import { useCampaigns } from '@/hooks/use-campaigns';
import { sendBulkEmails } from '@/lib/api/send-email';
import { useActivities } from '@/hooks/use-activities';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Send, Save, Eye, Users, FileText } from 'lucide-react';
import AudienceSelector from '@/components/campaigns/AudienceSelector';
import TemplateEditor from '@/components/campaigns/TemplateEditor';

export default function CampaignBuilderPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { leads } = useLeads();
  const { addCampaignAsync, updateCampaign } = useCampaigns();
  const { addActivity } = useActivities();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(1);
  const [campaignName, setCampaignName] = useState('');
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  // Only show leads with verified emails
  const emailSafeLeads = useMemo(() =>
    leads.filter(l => l.emailStatus === 'verified' || l.emailStatus === 'likely_to_engage'),
    [leads]
  );

  // Get a sample lead for preview
  const sampleLead = useMemo(() => {
    const firstId = Array.from(selectedLeadIds)[0];
    return leads.find(l => l.id === firstId);
  }, [leads, selectedLeadIds]);

  // Preview with merge fields replaced
  const previewSubject = sampleLead
    ? subject.replace(/\{\{firstName\}\}/g, sampleLead.firstName).replace(/\{\{company\}\}/g, sampleLead.company)
    : subject;
  const previewBody = sampleLead
    ? body.replace(/\{\{firstName\}\}/g, sampleLead.firstName).replace(/\{\{company\}\}/g, sampleLead.company).replace(/\{\{unsubscribeLink\}\}/g, '#unsubscribe')
    : body;

  const canProceedStep1 = campaignName.trim() && selectedLeadIds.size > 0;
  const canProceedStep2 = subject.trim() && body.trim();

  const handleSend = async () => {
    if (!user?.sendingEmail) {
      toast.error('Set your sending email in Settings before sending');
      return;
    }
    setSending(true);
    try {
      // Create campaign as draft first
      const campaign = await addCampaignAsync({
        name: campaignName.trim(),
        subject: subject.trim(),
        body: body.trim(),
        recipientIds: Array.from(selectedLeadIds),
        sentAt: new Date().toISOString(),
        sentBy: user.id,
        status: 'draft',
        abTestEnabled: false,
      });

      // Send emails
      const recipientIds = Array.from(selectedLeadIds);
      const campaignEmails = recipientIds.map(leadId => {
        const lead = leads.find(l => l.id === leadId);
        if (!lead) return null;
        return {
          leadId,
          from: user.sendingEmail!,
          fromName: user.name,
          to: lead.email,
          subject: subject.trim().replace('{{firstName}}', lead.firstName).replace('{{company}}', lead.company),
          body: body.trim().replace(/\{\{firstName\}\}/g, lead.firstName).replace(/\{\{company\}\}/g, lead.company),
          threadId: `t-camp-${Date.now()}-${leadId}`,
        };
      }).filter(Boolean) as Array<{ leadId: string; from: string; fromName: string; to: string; subject: string; body: string; threadId: string }>;

      const result = await sendBulkEmails(campaignEmails, campaign.id);

      // Update campaign status to active on success
      await updateCampaign(campaign.id, { status: 'completed' });

      if (result?.failedCount > 0) {
        toast.warning(`${result.failedCount} of ${campaignEmails.length} emails failed`);
      } else {
        toast.success(`Campaign sent to ${campaignEmails.length} recipients`);
      }

      // Log activities
      for (const leadId of recipientIds) {
        addActivity({ leadId, userId: user.id, type: 'email_sent', description: `Campaign: "${campaignName.trim()}"`, timestamp: new Date().toISOString() });
      }

      queryClient.invalidateQueries({ queryKey: ['emails'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      navigate('/outreach');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send campaign');
    } finally {
      setSending(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!user) return;
    try {
      await addCampaignAsync({
        name: campaignName.trim() || 'Untitled Campaign',
        subject: subject.trim(),
        body: body.trim(),
        recipientIds: Array.from(selectedLeadIds),
        sentAt: new Date().toISOString(),
        sentBy: user.id,
        status: 'draft',
        abTestEnabled: false,
      });
      toast.success('Campaign saved as draft');
      navigate('/outreach');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save draft');
    }
  };

  return (
    <div className="p-6 max-w-[900px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/outreach')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">New Campaign</h1>
            <p className="text-xs text-muted-foreground">Step {step} of 4</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Step indicators */}
          {[1, 2, 3, 4].map(s => (
            <div key={s} className={`h-2 w-8 rounded-full ${s <= step ? 'bg-primary' : 'bg-muted'}`} />
          ))}
        </div>
      </div>

      {/* Step 1: Name + Audience */}
      {step === 1 && (
        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Campaign Name & Audience</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Campaign Name</Label>
              <Input placeholder="e.g., Q1 SaaS Outreach" value={campaignName} onChange={e => setCampaignName(e.target.value)} />
            </div>
            <AudienceSelector leads={emailSafeLeads} selectedIds={selectedLeadIds} onSelectionChange={setSelectedLeadIds} />
            <div className="flex justify-end">
              <Button onClick={() => setStep(2)} disabled={!canProceedStep1} className="gap-1.5">
                Next: Template <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Template */}
      {step === 2 && (
        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Email Template</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <TemplateEditor subject={subject} body={body} onSubjectChange={setSubject} onBodyChange={setBody} />
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)} className="gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
              <Button onClick={() => setStep(3)} disabled={!canProceedStep2} className="gap-1.5">
                Next: Preview <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Preview */}
      {step === 3 && (
        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Eye className="h-4 w-4" /> Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {sampleLead && (
              <p className="text-xs text-muted-foreground">Previewing with: {sampleLead.firstName} {sampleLead.lastName} at {sampleLead.company}</p>
            )}
            <Card className="border bg-muted/20">
              <CardContent className="p-4 space-y-3">
                <div className="text-xs">
                  <span className="text-muted-foreground">From: </span>
                  <span className="font-medium">{user?.name} &lt;{user?.sendingEmail || 'not set'}&gt;</span>
                </div>
                <div className="text-xs">
                  <span className="text-muted-foreground">To: </span>
                  <span>{sampleLead ? sampleLead.email : 'recipient@example.com'}</span>
                </div>
                <div className="border-t pt-3">
                  <p className="text-sm font-medium">{previewSubject || '(no subject)'}</p>
                </div>
                <div className="border-t pt-3">
                  <p className="text-sm whitespace-pre-line leading-relaxed">{previewBody || '(no body)'}</p>
                </div>
              </CardContent>
            </Card>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>This email will be sent to <strong>{selectedLeadIds.size}</strong> recipients</span>
              {!user?.sendingEmail && <Badge variant="destructive" className="text-[10px]">Set sending email in Settings</Badge>}
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)} className="gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
              <Button onClick={() => setStep(4)} className="gap-1.5">
                Next: Confirm <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Confirm + Send */}
      {step === 4 && (
        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Send className="h-4 w-4" /> Confirm & Send</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Campaign</p>
                <p className="font-medium">{campaignName}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Recipients</p>
                <p className="font-medium">{selectedLeadIds.size} leads</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Subject</p>
                <p className="font-medium truncate">{subject}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">From</p>
                <p className="font-medium">{user?.sendingEmail || 'Not set'}</p>
              </div>
            </div>
            <div className="flex justify-between pt-4">
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(3)} className="gap-1.5">
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </Button>
                <Button variant="outline" onClick={handleSaveDraft} className="gap-1.5">
                  <Save className="h-3.5 w-3.5" /> Save as Draft
                </Button>
              </div>
              <Button onClick={handleSend} disabled={sending || !user?.sendingEmail} className="gap-1.5">
                <Send className="h-3.5 w-3.5" /> {sending ? 'Sending...' : `Send to ${selectedLeadIds.size} Recipients`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
