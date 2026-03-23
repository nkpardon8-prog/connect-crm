import { useState, useMemo } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { useAuth } from '@/contexts/AuthContext';
import { mockUsers, mockSequences } from '@/data/mockData';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Send, RefreshCw, Inbox, PenLine, Layers, Clock, Mail, MailOpen, Megaphone, ArrowRight, ArrowLeft, Users, ChevronDown, ChevronRight, Bot, Pencil } from 'lucide-react';
import type { LeadStatus } from '@/types/crm';
import CampaignAIChat from '@/components/outreach/CampaignAIChat';

const statusColors: Record<LeadStatus, string> = {
  cold: 'bg-blue-100 text-blue-700',
  lukewarm: 'bg-amber-100 text-amber-700',
  warm: 'bg-orange-100 text-orange-700',
  dead: 'bg-red-100 text-red-700',
};

export default function OutreachPage() {
  const { emails, leads, addEmail, addActivity, campaigns, addCampaign } = useCRM();
  const { user } = useAuth();
  const [tab, setTab] = useState('inbox');

  // Compose state
  const [toLeadId, setToLeadId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Campaign state
  const [campaignStep, setCampaignStep] = useState<'select' | 'compose'>('select');
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [industryFilter, setIndustryFilter] = useState<string>('all');
  const [campaignSearch, setCampaignSearch] = useState('');
  const [campaignSubject, setCampaignSubject] = useState('');
  const [campaignBody, setCampaignBody] = useState('');
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);

  const myLeads = leads.filter(l => l.assignedTo === user?.id);
  const sortedEmails = [...emails].sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());

  // Campaign filters
  const industries = useMemo(() => [...new Set(leads.map(l => l.industry))].sort(), [leads]);

  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      if (statusFilter !== 'all' && l.status !== statusFilter) return false;
      if (industryFilter !== 'all' && l.industry !== industryFilter) return false;
      if (campaignSearch) {
        const q = campaignSearch.toLowerCase();
        if (
          !l.firstName.toLowerCase().includes(q) &&
          !l.lastName.toLowerCase().includes(q) &&
          !l.company.toLowerCase().includes(q) &&
          !l.email.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [leads, statusFilter, industryFilter, campaignSearch]);

  const allFilteredSelected = filteredLeads.length > 0 && filteredLeads.every(l => selectedLeadIds.has(l.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      const newSet = new Set(selectedLeadIds);
      filteredLeads.forEach(l => newSet.delete(l.id));
      setSelectedLeadIds(newSet);
    } else {
      const newSet = new Set(selectedLeadIds);
      filteredLeads.forEach(l => newSet.add(l.id));
      setSelectedLeadIds(newSet);
    }
  };

  const toggleLead = (id: string) => {
    const newSet = new Set(selectedLeadIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedLeadIds(newSet);
  };

  const handleSendEmail = () => {
    if (!toLeadId || !subject.trim() || !body.trim()) return;
    const lead = leads.find(l => l.id === toLeadId);
    if (!lead) return;
    const email = {
      id: `e-${Date.now()}`,
      leadId: toLeadId,
      from: user!.email,
      to: lead.email,
      subject: subject.trim(),
      body: body.trim(),
      sentAt: new Date().toISOString(),
      read: true,
      direction: 'outbound' as const,
    };
    addEmail(email);
    addActivity({
      id: `a-${Date.now()}`,
      leadId: toLeadId,
      userId: user!.id,
      type: 'email_sent',
      description: `Sent email: "${subject.trim()}"`,
      timestamp: new Date().toISOString(),
    });
    setToLeadId('');
    setSubject('');
    setBody('');
    setTab('inbox');
  };

  const handleSendCampaign = () => {
    if (selectedLeadIds.size === 0 || !campaignSubject.trim() || !campaignBody.trim()) return;
    const recipientIds = Array.from(selectedLeadIds);
    const now = new Date().toISOString();

    const campaign = {
      id: `camp-${Date.now()}`,
      subject: campaignSubject.trim(),
      body: campaignBody.trim(),
      recipientIds,
      sentAt: now,
      sentBy: user!.id,
    };
    addCampaign(campaign);

    // Log activity + email for each recipient
    recipientIds.forEach((leadId, i) => {
      const lead = leads.find(l => l.id === leadId);
      if (!lead) return;
      addEmail({
        id: `e-camp-${Date.now()}-${i}`,
        leadId,
        from: user!.email,
        to: lead.email,
        subject: campaignSubject.trim().replace('{{firstName}}', lead.firstName).replace('{{company}}', lead.company),
        body: campaignBody.trim().replace(/\{\{firstName\}\}/g, lead.firstName).replace(/\{\{company\}\}/g, lead.company),
        sentAt: now,
        read: true,
        direction: 'outbound',
      });
      addActivity({
        id: `a-camp-${Date.now()}-${i}`,
        leadId,
        userId: user!.id,
        type: 'email_sent',
        description: `Campaign email: "${campaignSubject.trim()}"`,
        timestamp: now,
      });
    });

    // Reset
    setCampaignSubject('');
    setCampaignBody('');
    setSelectedLeadIds(new Set());
    setCampaignStep('select');
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  return (
    <div className="p-6 max-w-[1000px] space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Outreach</h1>
        <p className="text-sm text-muted-foreground">Email, campaigns, and sequences management</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="inbox" className="gap-1.5"><Inbox className="h-3.5 w-3.5" />Inbox</TabsTrigger>
          <TabsTrigger value="compose" className="gap-1.5"><PenLine className="h-3.5 w-3.5" />Compose</TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-1.5"><Megaphone className="h-3.5 w-3.5" />Campaigns</TabsTrigger>
          <TabsTrigger value="sequences" className="gap-1.5"><Layers className="h-3.5 w-3.5" />Sequences</TabsTrigger>
        </TabsList>

        {/* Inbox */}
        <TabsContent value="inbox" className="space-y-3 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{sortedEmails.length} messages</p>
            <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-1.5">
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          <div className="space-y-2">
            {sortedEmails.map(email => (
              <Card key={email.id} className="border shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      {email.direction === 'inbound' ? <Mail className="h-3.5 w-3.5 text-muted-foreground" /> : <MailOpen className="h-3.5 w-3.5 text-primary" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{email.subject}</p>
                        {!email.read && <Badge className="text-[10px] px-1.5 py-0">New</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {email.direction === 'inbound' ? `From: ${email.from}` : `To: ${email.to}`}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">{email.body}</p>
                      <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(email.sentAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Compose */}
        <TabsContent value="compose" className="mt-4">
          <Card className="border shadow-sm">
            <CardContent className="p-5 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">To</label>
                <Select value={toLeadId} onValueChange={setToLeadId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a lead..." />
                  </SelectTrigger>
                  <SelectContent>
                    {myLeads.map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.firstName} {l.lastName} — {l.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Subject</label>
                <Input placeholder="Email subject..." value={subject} onChange={e => setSubject(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Body</label>
                <Textarea placeholder="Write your email..." value={body} onChange={e => setBody(e.target.value)} className="min-h-[150px]" />
              </div>
              <Button onClick={handleSendEmail} disabled={!toLeadId || !subject.trim() || !body.trim()} className="gap-1.5">
                <Send className="h-4 w-4" /> Send Email
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Campaigns */}
        <TabsContent value="campaigns" className="mt-4 space-y-4">
          {campaignStep === 'select' && (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-foreground">Select Recipients</h2>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="gap-1">
                    <Users className="h-3 w-3" />
                    {selectedLeadIds.size} selected
                  </Badge>
                  <Button
                    size="sm"
                    disabled={selectedLeadIds.size === 0}
                    onClick={() => setCampaignStep('compose')}
                    className="gap-1.5"
                  >
                    Next <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  placeholder="Search by name, company, or email..."
                  value={campaignSearch}
                  onChange={e => setCampaignSearch(e.target.value)}
                  className="max-w-[280px] h-9"
                />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px] h-9">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="cold">Cold</SelectItem>
                    <SelectItem value="lukewarm">Lukewarm</SelectItem>
                    <SelectItem value="warm">Warm</SelectItem>
                    <SelectItem value="dead">Dead</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={industryFilter} onValueChange={setIndustryFilter}>
                  <SelectTrigger className="w-[180px] h-9">
                    <SelectValue placeholder="Industry" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Industries</SelectItem>
                    {industries.map(ind => (
                      <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Lead selection table */}
              <Card className="border shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={allFilteredSelected}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Industry</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeads.map(lead => (
                      <TableRow key={lead.id} className="cursor-pointer" onClick={() => toggleLead(lead.id)}>
                        <TableCell>
                          <Checkbox
                            checked={selectedLeadIds.has(lead.id)}
                            onCheckedChange={() => toggleLead(lead.id)}
                            onClick={e => e.stopPropagation()}
                          />
                        </TableCell>
                        <TableCell className="font-medium text-foreground">{lead.firstName} {lead.lastName}</TableCell>
                        <TableCell className="text-muted-foreground">{lead.email}</TableCell>
                        <TableCell className="text-muted-foreground">{lead.company}</TableCell>
                        <TableCell className="text-muted-foreground">{lead.industry}</TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[lead.status]}`}>
                            {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredLeads.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No leads match your filters
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Card>
            </>
          )}

          {campaignStep === 'compose' && (
            <>
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => setCampaignStep('select')} className="gap-1.5">
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </Button>
                <h2 className="text-base font-semibold text-foreground">Compose Campaign</h2>
                <Badge variant="secondary" className="gap-1">
                  <Users className="h-3 w-3" />
                  {selectedLeadIds.size} recipients
                </Badge>
              </div>

              <Card className="border shadow-sm">
                <CardContent className="p-5 space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Subject</label>
                    <Input
                      placeholder="Campaign subject line..."
                      value={campaignSubject}
                      onChange={e => setCampaignSubject(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Body</label>
                    <Textarea
                      placeholder="Write your campaign email..."
                      value={campaignBody}
                      onChange={e => setCampaignBody(e.target.value)}
                      className="min-h-[200px]"
                    />
                    <p className="text-xs text-muted-foreground">
                      Merge fields: <code className="bg-muted px-1 py-0.5 rounded text-[11px]">{'{{firstName}}'}</code>{' '}
                      <code className="bg-muted px-1 py-0.5 rounded text-[11px]">{'{{company}}'}</code>
                    </p>
                  </div>
                  <Button
                    onClick={handleSendCampaign}
                    disabled={!campaignSubject.trim() || !campaignBody.trim()}
                    className="gap-1.5"
                  >
                    <Send className="h-4 w-4" /> Send to {selectedLeadIds.size} recipients
                  </Button>
                </CardContent>
              </Card>
            </>
          )}

          {/* Campaign history */}
          <div className="pt-2">
            <h3 className="text-sm font-semibold text-foreground mb-3">Campaign History</h3>
            {campaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No campaigns sent yet</p>
            ) : (
              <div className="space-y-2">
                {campaigns.map(camp => {
                  const sender = mockUsers.find(u => u.id === camp.sentBy);
                  const isExpanded = expandedCampaign === camp.id;
                  return (
                    <Card key={camp.id} className="border shadow-sm">
                      <CardContent className="p-4">
                        <div
                          className="flex items-center justify-between cursor-pointer"
                          onClick={() => setExpandedCampaign(isExpanded ? null : camp.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{camp.subject}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {camp.recipientIds.length} recipients · Sent by {sender?.name ?? 'Unknown'} · {new Date(camp.sentAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{camp.recipientIds.length} sent</Badge>
                            {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t space-y-1.5">
                            {camp.recipientIds.map(rid => {
                              const lead = leads.find(l => l.id === rid);
                              if (!lead) return null;
                              return (
                                <div key={rid} className="flex items-center gap-2 text-sm px-2 py-1 rounded bg-muted/50">
                                  <Mail className="h-3 w-3 text-muted-foreground" />
                                  <span className="font-medium text-foreground">{lead.firstName} {lead.lastName}</span>
                                  <span className="text-muted-foreground">— {lead.email}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Sequences */}
        <TabsContent value="sequences" className="mt-4 space-y-3">
          {mockSequences.map(seq => (
            <Card key={seq.id} className="border shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{seq.name}</h3>
                    <p className="text-xs text-muted-foreground">{seq.steps.length} steps · Created by {mockUsers.find(u => u.id === seq.createdBy)?.name}</p>
                  </div>
                  <Badge variant={seq.active ? 'default' : 'secondary'}>{seq.active ? 'Active' : 'Paused'}</Badge>
                </div>
                <div className="space-y-2">
                  {seq.steps.map(step => (
                    <div key={step.id} className="flex items-center gap-3 text-sm p-2 rounded bg-muted/50">
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">{step.order}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{step.subject}</p>
                      </div>
                      {step.delayDays > 0 && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" /> +{step.delayDays}d
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
          <p className="text-xs text-muted-foreground text-center py-2">Sequence execution will be powered by email API integration</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
