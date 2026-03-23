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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, RefreshCw, Inbox, PenLine, Layers, Clock, Mail, MailOpen, Megaphone, ArrowRight, ArrowLeft, Users, ChevronDown, ChevronRight, Bot, Pencil, Reply, Forward, MailCheck, MailX, ArrowUpRight } from 'lucide-react';
import type { LeadStatus, EmailMessage } from '@/types/crm';
import CampaignAIChat from '@/components/outreach/CampaignAIChat';

const statusColors: Record<LeadStatus, string> = {
  cold: 'bg-blue-100 text-blue-700',
  lukewarm: 'bg-amber-100 text-amber-700',
  warm: 'bg-orange-100 text-orange-700',
  dead: 'bg-red-100 text-red-700',
};

interface EmailThread {
  id: string;
  subject: string;
  messages: EmailMessage[];
  latestAt: string;
  unreadCount: number;
  participants: string[];
  leadId?: string;
}

export default function OutreachPage() {
  const { emails, leads, addEmail, addActivity, campaigns, addCampaign, markEmailRead } = useCRM();
  const { user } = useAuth();
  const [tab, setTab] = useState('inbox');

  // Inbox state
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [replyMode, setReplyMode] = useState<'reply' | 'forward' | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [inboxSearch, setInboxSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Compose state
  const [toSearch, setToSearch] = useState('');
  const [toLeadId, setToLeadId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  // Campaign state
  const [campaignStep, setCampaignStep] = useState<'select' | 'compose'>('select');
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [industryFilter, setIndustryFilter] = useState<string>('all');
  const [campaignSearch, setCampaignSearch] = useState('');
  const [campaignSubject, setCampaignSubject] = useState('');
  const [campaignBody, setCampaignBody] = useState('');
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
  const [campaignMode, setCampaignMode] = useState<'manual' | 'ai'>('ai');

  // Build threads from emails
  const threads = useMemo<EmailThread[]>(() => {
    const threadMap = new Map<string, EmailMessage[]>();
    emails.forEach(email => {
      const tid = email.threadId || email.id;
      if (!threadMap.has(tid)) threadMap.set(tid, []);
      threadMap.get(tid)!.push(email);
    });
    const result: EmailThread[] = [];
    threadMap.forEach((msgs, tid) => {
      const sorted = [...msgs].sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
      const latest = sorted[sorted.length - 1];
      const participants = [...new Set(sorted.flatMap(m => [m.from, m.to]))];
      result.push({
        id: tid,
        subject: sorted[0].subject.replace(/^(Re: |Fwd: )+/i, ''),
        messages: sorted,
        latestAt: latest.sentAt,
        unreadCount: sorted.filter(m => !m.read).length,
        participants,
        leadId: sorted.find(m => m.leadId)?.leadId,
      });
    });
    return result.sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime());
  }, [emails]);

  const filteredThreads = useMemo(() => {
    if (!inboxSearch) return threads;
    const q = inboxSearch.toLowerCase();
    return threads.filter(t =>
      t.subject.toLowerCase().includes(q) ||
      t.participants.some(p => p.toLowerCase().includes(q)) ||
      t.messages.some(m => m.body.toLowerCase().includes(q))
    );
  }, [threads, inboxSearch]);

  const selectedThread = threads.find(t => t.id === selectedThreadId) ?? null;

  // Compose lead search
  const filteredComposeLeads = useMemo(() => {
    if (!toSearch) return leads.slice(0, 10);
    const q = toSearch.toLowerCase();
    return leads.filter(l =>
      l.firstName.toLowerCase().includes(q) ||
      l.lastName.toLowerCase().includes(q) ||
      l.email.toLowerCase().includes(q) ||
      l.company.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [leads, toSearch]);

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

  const handleSelectThread = (thread: EmailThread) => {
    setSelectedThreadId(thread.id);
    setReplyMode(null);
    setReplyBody('');
    // Mark all unread messages as read
    thread.messages.filter(m => !m.read).forEach(m => markEmailRead(m.id));
  };

  const handleSendReply = () => {
    if (!selectedThread || !replyBody.trim()) return;
    const lastMsg = selectedThread.messages[selectedThread.messages.length - 1];
    const isForward = replyMode === 'forward';

    const toAddress = isForward ? '' : (lastMsg.direction === 'inbound' ? lastMsg.from : lastMsg.to);
    const newSubject = isForward
      ? `Fwd: ${selectedThread.subject}`
      : `Re: ${selectedThread.subject}`;

    const email: EmailMessage = {
      id: `e-${Date.now()}`,
      leadId: selectedThread.leadId,
      from: user!.email,
      to: toAddress,
      subject: newSubject,
      body: replyBody.trim(),
      sentAt: new Date().toISOString(),
      read: true,
      direction: 'outbound',
      threadId: selectedThread.id,
      replyToId: lastMsg.id,
    };
    addEmail(email);
    if (selectedThread.leadId) {
      addActivity({
        id: `a-${Date.now()}`,
        leadId: selectedThread.leadId,
        userId: user!.id,
        type: 'email_sent',
        description: `${isForward ? 'Forwarded' : 'Replied'}: "${newSubject}"`,
        timestamp: new Date().toISOString(),
      });
    }
    setReplyBody('');
    setReplyMode(null);
  };

  const handleSendEmail = () => {
    if (!toLeadId || !subject.trim() || !body.trim()) return;
    const lead = leads.find(l => l.id === toLeadId);
    if (!lead) return;
    const threadId = `t-${Date.now()}`;
    const email: EmailMessage = {
      id: `e-${Date.now()}`,
      leadId: toLeadId,
      from: user!.email,
      to: lead.email,
      subject: subject.trim(),
      body: body.trim(),
      sentAt: new Date().toISOString(),
      read: true,
      direction: 'outbound',
      threadId,
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
    setToSearch('');
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
        threadId: `t-camp-${Date.now()}-${i}`,
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

    setCampaignSubject('');
    setCampaignBody('');
    setSelectedLeadIds(new Set());
    setCampaignStep('select');
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const getContactName = (email: string) => {
    const lead = leads.find(l => l.email === email);
    if (lead) return `${lead.firstName} ${lead.lastName}`;
    const usr = mockUsers.find(u => u.email === email);
    if (usr) return usr.name;
    return email.split('@')[0];
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHrs = diffMs / (1000 * 60 * 60);
    if (diffHrs < 1) return `${Math.max(1, Math.round(diffMs / 60000))}m ago`;
    if (diffHrs < 24) return `${Math.round(diffHrs)}h ago`;
    if (diffHrs < 48) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const isOwnEmail = (email: string) => mockUsers.some(u => u.email === email);

  return (
    <div className="p-6 max-w-[1200px] space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Outreach</h1>
        <p className="text-sm text-muted-foreground">Email, campaigns, and sequences management</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v); if (v !== 'inbox') setSelectedThreadId(null); }}>
        <TabsList>
          <TabsTrigger value="inbox" className="gap-1.5"><Inbox className="h-3.5 w-3.5" />Inbox</TabsTrigger>
          <TabsTrigger value="compose" className="gap-1.5"><PenLine className="h-3.5 w-3.5" />Compose</TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-1.5"><Megaphone className="h-3.5 w-3.5" />Campaigns</TabsTrigger>
          <TabsTrigger value="sequences" className="gap-1.5"><Layers className="h-3.5 w-3.5" />Sequences</TabsTrigger>
        </TabsList>

        {/* ===== INBOX ===== */}
        <TabsContent value="inbox" className="mt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Input
                placeholder="Search emails..."
                value={inboxSearch}
                onChange={e => setInboxSearch(e.target.value)}
                className="w-[260px] h-9"
              />
              <p className="text-sm text-muted-foreground">{filteredThreads.length} conversations</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-1.5">
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          <div className="flex border rounded-lg bg-background overflow-hidden" style={{ height: 'calc(100vh - 240px)', minHeight: '500px' }}>
            {/* Thread list */}
            <div className={`${selectedThread ? 'hidden md:flex' : 'flex'} flex-col border-r w-full md:w-[360px] md:min-w-[360px]`}>
              <ScrollArea className="flex-1">
                {filteredThreads.length === 0 ? (
                  <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
                    No conversations found
                  </div>
                ) : (
                  filteredThreads.map(thread => {
                    const isSelected = selectedThreadId === thread.id;
                    const latestMsg = thread.messages[thread.messages.length - 1];
                    const otherParticipant = thread.participants.find(p => !isOwnEmail(p)) || thread.participants[0];

                    return (
                      <div
                        key={thread.id}
                        onClick={() => handleSelectThread(thread)}
                        className={`px-4 py-3 border-b cursor-pointer transition-colors hover:bg-accent/50 ${
                          isSelected ? 'bg-accent' : ''
                        } ${thread.unreadCount > 0 ? '' : ''}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-0.5">
                            {thread.unreadCount > 0 ? (
                              <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                            ) : (
                              <div className="h-2.5 w-2.5" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className={`text-sm truncate ${thread.unreadCount > 0 ? 'font-semibold text-foreground' : 'font-medium text-foreground'}`}>
                                {getContactName(otherParticipant)}
                              </p>
                              <span className="text-[11px] text-muted-foreground flex-shrink-0">{formatTime(thread.latestAt)}</span>
                            </div>
                            <p className={`text-sm truncate mt-0.5 ${thread.unreadCount > 0 ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                              {thread.subject}
                            </p>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {latestMsg.direction === 'outbound' ? 'You: ' : ''}{latestMsg.body.split('\n')[0].slice(0, 80)}
                            </p>
                            {thread.messages.length > 1 && (
                              <span className="text-[11px] text-muted-foreground">{thread.messages.length} messages</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </ScrollArea>
            </div>

            {/* Conversation view */}
            <div className={`${selectedThread ? 'flex' : 'hidden md:flex'} flex-col flex-1`}>
              {selectedThread ? (
                <>
                  {/* Thread header */}
                  <div className="flex items-center gap-3 px-5 py-3 border-b bg-background">
                    <Button variant="ghost" size="icon" className="md:hidden h-8 w-8" onClick={() => setSelectedThreadId(null)}>
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-foreground truncate">{selectedThread.subject}</h3>
                      <p className="text-xs text-muted-foreground">
                        {selectedThread.messages.length} message{selectedThread.messages.length !== 1 ? 's' : ''} · {selectedThread.participants.filter(p => !isOwnEmail(p)).map(getContactName).join(', ')}
                      </p>
                    </div>
                  </div>

                  {/* Messages */}
                  <ScrollArea className="flex-1 px-5 py-4">
                    <div className="space-y-4 max-w-[640px]">
                      {selectedThread.messages.map(msg => {
                        const isSent = msg.direction === 'outbound';
                        return (
                          <div key={msg.id} className={`flex flex-col ${isSent ? 'items-end' : 'items-start'}`}>
                            <div className={`max-w-[85%] rounded-lg px-4 py-3 ${
                              isSent
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-foreground'
                            }`}>
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className={`text-xs font-medium ${isSent ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                                  {isSent ? 'You' : getContactName(msg.from)}
                                </span>
                                <span className={`text-[11px] ${isSent ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                                  {new Date(msg.sentAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className={`text-sm whitespace-pre-line leading-relaxed ${isSent ? 'text-primary-foreground' : 'text-foreground'}`}>
                                {msg.body}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>

                  {/* Reply/Forward area */}
                  <div className="border-t p-4">
                    {!replyMode ? (
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setReplyMode('reply')} className="gap-1.5">
                          <Reply className="h-3.5 w-3.5" /> Reply
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setReplyMode('forward')} className="gap-1.5">
                          <Forward className="h-3.5 w-3.5" /> Forward
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-muted-foreground">
                            {replyMode === 'reply' ? `Reply to ${getContactName(selectedThread.messages[selectedThread.messages.length - 1].direction === 'inbound' ? selectedThread.messages[selectedThread.messages.length - 1].from : selectedThread.messages[selectedThread.messages.length - 1].to)}` : 'Forward this conversation'}
                          </p>
                          <Button variant="ghost" size="sm" onClick={() => { setReplyMode(null); setReplyBody(''); }} className="h-7 text-xs">
                            Cancel
                          </Button>
                        </div>
                        <Textarea
                          placeholder={replyMode === 'reply' ? 'Type your reply...' : 'Add a message...'}
                          value={replyBody}
                          onChange={e => setReplyBody(e.target.value)}
                          className="min-h-[100px]"
                          autoFocus
                        />
                        <Button
                          size="sm"
                          onClick={handleSendReply}
                          disabled={!replyBody.trim()}
                          className="gap-1.5"
                        >
                          <Send className="h-3.5 w-3.5" /> Send
                        </Button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center space-y-2">
                    <Mail className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                    <p className="text-sm text-muted-foreground">Select a conversation to read</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ===== COMPOSE ===== */}
        <TabsContent value="compose" className="mt-4">
          <Card className="border shadow-sm max-w-[640px]">
            <CardContent className="p-5 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">To</label>
                <div className="relative">
                  <Input
                    placeholder="Search for a lead by name, email, or company..."
                    value={toLeadId ? `${leads.find(l => l.id === toLeadId)?.firstName} ${leads.find(l => l.id === toLeadId)?.lastName} — ${leads.find(l => l.id === toLeadId)?.email}` : toSearch}
                    onChange={e => { setToSearch(e.target.value); setToLeadId(''); }}
                    onFocus={() => { if (toLeadId) { setToSearch(''); setToLeadId(''); } }}
                  />
                  {!toLeadId && toSearch && (
                    <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-background border rounded-md shadow-lg max-h-[200px] overflow-y-auto">
                      {filteredComposeLeads.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">No leads found</div>
                      ) : (
                        filteredComposeLeads.map(l => (
                          <div
                            key={l.id}
                            className="px-3 py-2 text-sm cursor-pointer hover:bg-accent transition-colors"
                            onClick={() => { setToLeadId(l.id); setToSearch(''); }}
                          >
                            <span className="font-medium text-foreground">{l.firstName} {l.lastName}</span>
                            <span className="text-muted-foreground"> — {l.email}</span>
                            <span className="text-muted-foreground text-xs ml-1">({l.company})</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Subject</label>
                <Input placeholder="Email subject..." value={subject} onChange={e => setSubject(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Body</label>
                <Textarea placeholder="Write your email..." value={body} onChange={e => setBody(e.target.value)} className="min-h-[200px]" />
              </div>
              <Button onClick={handleSendEmail} disabled={!toLeadId || !subject.trim() || !body.trim()} className="gap-1.5">
                <Send className="h-4 w-4" /> Send Email
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== CAMPAIGNS ===== */}
        <TabsContent value="campaigns" className="mt-4 space-y-4">
          {/* Mode toggle */}
          <div className="flex items-center gap-2">
            <Button
              variant={campaignMode === 'ai' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCampaignMode('ai')}
              className="gap-1.5"
            >
              <Bot className="h-3.5 w-3.5" /> AI Assistant
            </Button>
            <Button
              variant={campaignMode === 'manual' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCampaignMode('manual')}
              className="gap-1.5"
            >
              <Pencil className="h-3.5 w-3.5" /> Manual
            </Button>
          </div>

          {/* AI Mode */}
          {campaignMode === 'ai' && (
            <>
              <CampaignAIChat
                leads={leads}
                industries={industries}
                onApplyResult={(result) => {
                  setSelectedLeadIds(new Set(result.matchedLeadIds));
                  setCampaignSubject(result.subject);
                  setCampaignBody(result.body);
                  if (result.statusFilter) setStatusFilter(result.statusFilter);
                  else setStatusFilter('all');
                  if (result.industryFilter) setIndustryFilter(result.industryFilter);
                  else setIndustryFilter('all');
                  setCampaignStep('compose');
                }}
              />

              {campaignStep === 'compose' && selectedLeadIds.size > 0 && (
                <Card className="border shadow-sm">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-foreground">AI-Generated Campaign</h3>
                      <Badge variant="secondary" className="gap-1">
                        <Users className="h-3 w-3" />
                        {selectedLeadIds.size} recipients
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Subject</label>
                      <Input value={campaignSubject} onChange={e => setCampaignSubject(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Body</label>
                      <Textarea value={campaignBody} onChange={e => setCampaignBody(e.target.value)} className="min-h-[160px]" />
                      <p className="text-xs text-muted-foreground">
                        Merge fields: <code className="bg-muted px-1 py-0.5 rounded text-[11px]">{'{{firstName}}'}</code>{' '}
                        <code className="bg-muted px-1 py-0.5 rounded text-[11px]">{'{{company}}'}</code>
                      </p>
                    </div>
                    <Button onClick={handleSendCampaign} disabled={!campaignSubject.trim() || !campaignBody.trim()} className="gap-1.5">
                      <Send className="h-4 w-4" /> Send to {selectedLeadIds.size} recipients
                    </Button>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Manual Mode */}
          {campaignMode === 'manual' && campaignStep === 'select' && (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-foreground">Select Recipients</h2>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="gap-1">
                    <Users className="h-3 w-3" />
                    {selectedLeadIds.size} selected
                  </Badge>
                  <Button size="sm" disabled={selectedLeadIds.size === 0} onClick={() => setCampaignStep('compose')} className="gap-1.5">
                    Next <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Input placeholder="Search by name, company, or email..." value={campaignSearch} onChange={e => setCampaignSearch(e.target.value)} className="max-w-[280px] h-9" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="cold">Cold</SelectItem>
                    <SelectItem value="lukewarm">Lukewarm</SelectItem>
                    <SelectItem value="warm">Warm</SelectItem>
                    <SelectItem value="dead">Dead</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={industryFilter} onValueChange={setIndustryFilter}>
                  <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Industry" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Industries</SelectItem>
                    {industries.map(ind => (
                      <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Card className="border shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]"><Checkbox checked={allFilteredSelected} onCheckedChange={toggleSelectAll} /></TableHead>
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
                        <TableCell><Checkbox checked={selectedLeadIds.has(lead.id)} onCheckedChange={() => toggleLead(lead.id)} onClick={e => e.stopPropagation()} /></TableCell>
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
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No leads match your filters</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Card>
            </>
          )}

          {campaignMode === 'manual' && campaignStep === 'compose' && (
            <>
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => setCampaignStep('select')} className="gap-1.5"><ArrowLeft className="h-3.5 w-3.5" /> Back</Button>
                <h2 className="text-base font-semibold text-foreground">Compose Campaign</h2>
                <Badge variant="secondary" className="gap-1"><Users className="h-3 w-3" />{selectedLeadIds.size} recipients</Badge>
              </div>

              <Card className="border shadow-sm">
                <CardContent className="p-5 space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Subject</label>
                    <Input placeholder="Campaign subject line..." value={campaignSubject} onChange={e => setCampaignSubject(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Body</label>
                    <Textarea placeholder="Write your campaign email..." value={campaignBody} onChange={e => setCampaignBody(e.target.value)} className="min-h-[200px]" />
                    <p className="text-xs text-muted-foreground">
                      Merge fields: <code className="bg-muted px-1 py-0.5 rounded text-[11px]">{'{{firstName}}'}</code>{' '}
                      <code className="bg-muted px-1 py-0.5 rounded text-[11px]">{'{{company}}'}</code>
                    </p>
                  </div>
                  <Button onClick={handleSendCampaign} disabled={!campaignSubject.trim() || !campaignBody.trim()} className="gap-1.5">
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
                        <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedCampaign(isExpanded ? null : camp.id)}>
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

        {/* ===== SEQUENCES ===== */}
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
