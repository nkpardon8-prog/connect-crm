import { useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { useAuth } from '@/contexts/AuthContext';
import type { Lead } from '@/types/crm';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sparkles, Send, Bot, User as UserIcon, Import } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'bot';
  content: string;
  leads?: Lead[];
}

const fakeGeneratedLeads = (prompt: string): Lead[] => {
  const id = Date.now().toString();
  return [
    { id: `gen-${id}-1`, firstName: 'Alex', lastName: 'Werner', email: 'awerner@scalegrid.io', phone: '+14155559001', jobTitle: 'CTO', company: 'ScaleGrid', companySize: '51-200', industry: 'SaaS', location: 'Austin, TX', status: 'cold', assignedTo: '', createdAt: new Date().toISOString(), lastContactedAt: null, notes: `Generated from: "${prompt}"`, tags: ['generated'] },
    { id: `gen-${id}-2`, firstName: 'Monica', lastName: 'Tan', email: 'mtan@cloudpeak.dev', phone: '+12065559002', jobTitle: 'VP Engineering', company: 'CloudPeak', companySize: '201-500', industry: 'Cloud', location: 'Seattle, WA', status: 'cold', assignedTo: '', createdAt: new Date().toISOString(), lastContactedAt: null, notes: `Generated from: "${prompt}"`, tags: ['generated'] },
    { id: `gen-${id}-3`, firstName: 'Raj', lastName: 'Gupta', email: 'rgupta@dataflow.com', phone: '+16505559003', jobTitle: 'Director of Engineering', company: 'DataFlow Inc', companySize: '51-200', industry: 'Data', location: 'San Jose, CA', status: 'cold', assignedTo: '', createdAt: new Date().toISOString(), lastContactedAt: null, notes: `Generated from: "${prompt}"`, tags: ['generated'] },
    { id: `gen-${id}-4`, firstName: 'Sarah', lastName: 'Kim', email: 'skim@nexgenapi.co', phone: '+13125559004', jobTitle: 'CTO', company: 'NexGen API', companySize: '11-50', industry: 'API Platform', location: 'Chicago, IL', status: 'cold', assignedTo: '', createdAt: new Date().toISOString(), lastContactedAt: null, notes: `Generated from: "${prompt}"`, tags: ['generated'] },
    { id: `gen-${id}-5`, firstName: 'Derek', lastName: 'Olson', email: 'dolson@vertexsaas.com', phone: '+17375559005', jobTitle: 'Head of Platform', company: 'Vertex SaaS', companySize: '201-500', industry: 'SaaS', location: 'Salt Lake City, UT', status: 'cold', assignedTo: '', createdAt: new Date().toISOString(), lastContactedAt: null, notes: `Generated from: "${prompt}"`, tags: ['generated'] },
  ];
};

export default function LeadGeneratorPage() {
  const { addLeads } = useCRM();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'bot', content: 'Describe your ideal customer profile and I\'ll generate a lead list from Apollo.io. For example: "CTOs at SaaS companies, 50-200 employees, based in Austin"' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [importedSets, setImportedSets] = useState<Set<number>>(new Set());

  const handleSend = () => {
    if (!input.trim() || loading) return;
    const userMsg: ChatMessage = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    setTimeout(() => {
      const generated = fakeGeneratedLeads(userMsg.content);
      const botMsg: ChatMessage = {
        role: 'bot',
        content: `Found ${generated.length} contacts matching your criteria. Here's the list:`,
        leads: generated,
      };
      setMessages(prev => [...prev, botMsg]);
      setLoading(false);
    }, 1500);
  };

  const handleImport = (leads: Lead[], msgIndex: number) => {
    const assignedLeads = leads.map(l => ({ ...l, assignedTo: user!.id }));
    addLeads(assignedLeads);
    setImportedSets(prev => new Set([...prev, msgIndex]));
  };

  return (
    <div className="p-6 max-w-[900px] mx-auto flex flex-col" style={{ height: 'calc(100vh - 3.5rem)' }}>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" /> Lead Generator
        </h1>
        <p className="text-sm text-muted-foreground">Describe your ideal customers to generate leads via Apollo.io</p>
      </div>

      {/* Chat area */}
      <Card className="flex-1 border shadow-sm flex flex-col min-h-0">
        <CardContent className="flex-1 overflow-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
              {msg.role === 'bot' && (
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              )}
              <div className={`max-w-[80%] space-y-3 ${msg.role === 'user' ? 'order-first' : ''}`}>
                <div className={`rounded-lg px-4 py-2.5 text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground ml-auto' : 'bg-muted'}`}>
                  {msg.content}
                </div>
                {msg.leads && (
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Name</TableHead>
                          <TableHead className="text-xs">Title</TableHead>
                          <TableHead className="text-xs">Company</TableHead>
                          <TableHead className="text-xs">Location</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {msg.leads.map(l => (
                          <TableRow key={l.id}>
                            <TableCell className="text-xs font-medium">{l.firstName} {l.lastName}</TableCell>
                            <TableCell className="text-xs">{l.jobTitle}</TableCell>
                            <TableCell className="text-xs">{l.company}</TableCell>
                            <TableCell className="text-xs">{l.location}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="p-2 border-t bg-muted/30">
                      <Button
                        size="sm"
                        onClick={() => handleImport(msg.leads!, i)}
                        disabled={importedSets.has(i)}
                        className="gap-1.5"
                      >
                        <Import className="h-3.5 w-3.5" />
                        {importedSets.has(i) ? 'Imported to CRM' : `Import ${msg.leads.length} as Cold Leads`}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <UserIcon className="h-4 w-4 text-primary-foreground" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="rounded-lg bg-muted px-4 py-2.5 text-sm text-muted-foreground">
                Searching Apollo.io for matching contacts...
              </div>
            </div>
          )}
        </CardContent>

        {/* Input */}
        <div className="p-4 border-t">
          <form onSubmit={e => { e.preventDefault(); handleSend(); }} className="flex gap-2">
            <Input
              placeholder="Describe your ideal customer profile..."
              value={input}
              onChange={e => setInput(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={!input.trim() || loading} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
