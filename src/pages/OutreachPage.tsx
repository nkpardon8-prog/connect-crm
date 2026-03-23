import { useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { useAuth } from '@/contexts/AuthContext';
import { mockUsers, mockSequences } from '@/data/mockData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send, RefreshCw, Inbox, PenLine, Layers, Clock, Mail, MailOpen } from 'lucide-react';

export default function OutreachPage() {
  const { emails, leads, addEmail, addActivity } = useCRM();
  const { user } = useAuth();
  const [tab, setTab] = useState('inbox');

  // Compose state
  const [toLeadId, setToLeadId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const [refreshing, setRefreshing] = useState(false);

  const myLeads = leads.filter(l => l.assignedTo === user?.id);
  const sortedEmails = [...emails].sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());

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

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  return (
    <div className="p-6 max-w-[1000px] space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Outreach</h1>
        <p className="text-sm text-muted-foreground">Email and sequences management</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="inbox" className="gap-1.5"><Inbox className="h-3.5 w-3.5" />Inbox</TabsTrigger>
          <TabsTrigger value="compose" className="gap-1.5"><PenLine className="h-3.5 w-3.5" />Compose</TabsTrigger>
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
