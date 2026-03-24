import { useState, useEffect } from 'react';
import { useLeads } from '@/hooks/use-leads';
import { useAuth } from '@/contexts/AuthContext';
import { searchApollo } from '@/lib/api/apollo';
import { saveSearchHistory, loadSearchHistory, markSearchImported, type SearchHistoryEntry } from '@/lib/api/search-history';
import type { Lead } from '@/types/crm';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Sparkles, Send, Bot, User as UserIcon, Import, Mail, Phone } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'bot';
  content: string;
  leads?: Lead[];
}

export default function LeadGeneratorPage() {
  const { addLeads } = useLeads();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'bot', content: 'Describe your ideal customer profile and I\'ll search Apollo.io for matching contacts with verified contact information.\n\nFor example: "CTOs at SaaS companies, 50-200 employees, based in Austin"' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [importedSets, setImportedSets] = useState<Set<number>>(new Set());
  const [selectedCount, setSelectedCount] = useState(25);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState('');
  const [historyIds, setHistoryIds] = useState<Map<number, string>>(new Map());

  const estimatedCredits = Math.min(selectedCount * 2, 50);

  useEffect(() => {
    if (!user) return;
    loadSearchHistory(user.id).then((history: SearchHistoryEntry[]) => {
      if (history.length === 0) return;

      const restoredMessages: ChatMessage[] = [
        { role: 'bot', content: 'Describe your ideal customer profile and I\'ll search Apollo.io for matching contacts with verified contact information.\n\nFor example: "CTOs at SaaS companies, 50-200 employees, based in Austin"' },
      ];
      const restoredImported = new Set<number>();
      const restoredHistoryIds = new Map<number, string>();

      for (const entry of history) {
        // User message
        restoredMessages.push({ role: 'user', content: entry.prompt });
        // Bot response with leads
        const botIndex = restoredMessages.length;
        const botContent = entry.leads.length > 0
          ? `Found ${entry.totalFound.toLocaleString()} total matches. Showing ${entry.leads.length} enriched contacts with verified contact info (${entry.creditsUsed} credits used).`
          : 'No matching contacts found with verified contact information. Try broadening your search criteria.';
        restoredMessages.push({
          role: 'bot',
          content: botContent,
          leads: entry.leads.length > 0 ? entry.leads : undefined,
        });
        // Track history ID for this bot message
        restoredHistoryIds.set(botIndex, entry.id);
        // Mark as imported if already imported
        if (entry.imported) {
          restoredImported.add(botIndex);
        }
      }

      setMessages(restoredMessages);
      setImportedSets(restoredImported);
      setHistoryIds(restoredHistoryIds);
    }).catch(console.error);
  }, [user]);

  const handleSend = () => {
    if (!input.trim() || loading) return;
    setPendingPrompt(input.trim());
    setShowConfirm(true);
  };

  const executeSearch = async () => {
    setShowConfirm(false);
    const userMsg: ChatMessage = { role: 'user', content: pendingPrompt };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const result = await searchApollo(pendingPrompt, selectedCount);

      // Save to search history immediately
      let historyId = '';
      try {
        historyId = await saveSearchHistory({
          userId: user!.id,
          prompt: pendingPrompt,
          leads: result.leads,
          filters: result.filtersUsed,
          totalFound: result.totalFound,
          creditsUsed: result.creditsUsed,
        });
      } catch (e) {
        console.error('Failed to save search history:', e);
      }

      const botContent = result.leads.length > 0
        ? `Found ${result.totalFound.toLocaleString()} total matches. Showing ${result.leads.length} enriched contacts with verified contact info (${result.creditsUsed} credits used).`
        : 'No matching contacts found with verified contact information. Try broadening your search criteria.';

      const botMsg: ChatMessage = {
        role: 'bot',
        content: botContent,
        leads: result.leads.length > 0 ? result.leads : undefined,
      };

      // Capture current length before the state update to compute bot message index.
      // At this point messages has: initial welcome + user msg just added = messages.length + 1.
      // Bot msg will land at that index + 1, i.e. messages.length + 1.
      const botIndex = messages.length + 1;
      setMessages(prev => [...prev, botMsg]);
      if (historyId) {
        setHistoryIds(prev => { const next = new Map(prev); next.set(botIndex, historyId); return next; });
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'An unexpected error occurred';
      setMessages(prev => [...prev, { role: 'bot', content: `Error: ${errorMsg}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = (leads: Lead[], msgIndex: number) => {
    const cleanedLeads = leads.map(({ id, createdAt, ...rest }) => ({
      ...rest,
      assignedTo: user!.id,
    }));
    addLeads(cleanedLeads);
    setImportedSets(prev => new Set([...prev, msgIndex]));
    // Mark search history entry as imported
    const historyId = historyIds.get(msgIndex);
    if (historyId) {
      markSearchImported(historyId).catch(console.error);
    }
  };

  const contactBadge = (lead: Lead) => {
    const hasEmail = !!lead.email;
    const hasPhone = !!lead.phone;
    if (hasEmail && hasPhone) return <Badge variant="secondary" className="text-[10px] bg-emerald-50 text-emerald-700">Both</Badge>;
    if (hasEmail) return <Badge variant="secondary" className="text-[10px] bg-blue-50 text-blue-700">Email</Badge>;
    if (hasPhone) return <Badge variant="secondary" className="text-[10px] bg-amber-50 text-amber-700">Phone</Badge>;
    return null;
  };

  return (
    <div className="p-6 max-w-[1000px] mx-auto flex flex-col" style={{ height: 'calc(100vh - 3.5rem)' }}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Lead Generator
          </h1>
          <p className="text-sm text-muted-foreground">Describe your ideal customers to discover leads via Apollo.io</p>
        </div>
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
              <div className={`max-w-[90%] space-y-3 ${msg.role === 'user' ? 'order-first' : ''}`}>
                <div className={`rounded-lg px-4 py-2.5 text-sm whitespace-pre-line ${msg.role === 'user' ? 'bg-primary text-primary-foreground ml-auto' : 'bg-muted'}`}>
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
                          <TableHead className="text-xs">Email</TableHead>
                          <TableHead className="text-xs">Phone</TableHead>
                          <TableHead className="text-xs">Location</TableHead>
                          <TableHead className="text-xs w-[50px]">Contact</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {msg.leads.map(l => (
                          <TableRow key={l.id}>
                            <TableCell className="text-xs font-medium">{l.firstName} {l.lastName}</TableCell>
                            <TableCell className="text-xs">{l.jobTitle}</TableCell>
                            <TableCell className="text-xs">{l.company}</TableCell>
                            <TableCell className="text-xs truncate max-w-[150px]">
                              {l.email ? (
                                <span className="flex items-center gap-1"><Mail className="h-3 w-3 text-muted-foreground" />{l.email}</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs">
                              {l.phone ? (
                                <span className="flex items-center gap-1"><Phone className="h-3 w-3 text-muted-foreground" />{l.phone}</span>
                              ) : (
                                <span className="text-[10px] text-muted-foreground italic">pending...</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs">{l.location}</TableCell>
                            <TableCell className="text-xs">{contactBadge(l)}</TableCell>
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
                Searching Apollo.io and enriching contacts...
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
            <Select value={String(selectedCount)} onValueChange={v => setSelectedCount(Number(v))}>
              <SelectTrigger className="w-[80px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" disabled={!input.trim() || loading} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Search Apollo.io</AlertDialogTitle>
            <AlertDialogDescription>
              This will search for up to {selectedCount} leads and enrich up to {estimatedCredits} contacts to find verified contact information.
              Approximately <strong>{estimatedCredits} Apollo credits</strong> will be used.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeSearch}>Search</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
