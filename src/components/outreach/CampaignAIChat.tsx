import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Bot, User } from 'lucide-react';
import type { Lead } from '@/types/crm';
import type { LeadStatus } from '@/types/crm';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface AIResult {
  matchedLeadIds: string[];
  subject: string;
  body: string;
  statusFilter?: string;
  industryFilter?: string;
}

interface CampaignAIChatProps {
  leads: Lead[];
  industries: string[];
  onApplyResult: (result: AIResult) => void;
}

const STATUS_KEYWORDS: LeadStatus[] = ['cold', 'lukewarm', 'warm', 'dead'];

function parsePrompt(prompt: string, leads: Lead[], industries: string[]): AIResult {
  const lower = prompt.toLowerCase();

  // Match status
  const matchedStatus = STATUS_KEYWORDS.find(s => lower.includes(s));

  // Match industry (case-insensitive)
  const matchedIndustry = industries.find(ind => lower.includes(ind.toLowerCase()));

  // Filter leads
  let filtered = [...leads];
  if (matchedStatus) {
    filtered = filtered.filter(l => l.status === matchedStatus);
  }
  if (matchedIndustry) {
    filtered = filtered.filter(l => l.industry.toLowerCase() === matchedIndustry.toLowerCase());
  }

  const matchedLeadIds = filtered.map(l => l.id);

  // Extract topic from prompt — strip known keywords to find the core message
  let topic = prompt;
  STATUS_KEYWORDS.forEach(s => { topic = topic.replace(new RegExp(s, 'gi'), ''); });
  industries.forEach(ind => { topic = topic.replace(new RegExp(ind, 'gi'), ''); });
  topic = topic.replace(/\b(send|email|outreach|campaign|all|leads|to|a|an|the|about|introducing|our|for|with)\b/gi, '').trim();
  if (!topic) topic = 'our services';

  const subject = `Introducing ${topic} — let's connect, {{firstName}}`;
  const body = `Hi {{firstName}},\n\nI came across {{company}} and thought you'd be interested in ${topic}.\n\nWe've been helping companies in your space achieve meaningful results, and I'd love to explore how we can do the same for your team.\n\nWould you be open to a quick call this week?\n\nBest regards`;

  return {
    matchedLeadIds,
    subject,
    body,
    statusFilter: matchedStatus ?? undefined,
    industryFilter: matchedIndustry ?? undefined,
  };
}

function buildAssistantMessage(result: AIResult, leads: Lead[]): string {
  const parts: string[] = [];

  if (result.statusFilter || result.industryFilter) {
    const filters: string[] = [];
    if (result.statusFilter) filters.push(`status: **${result.statusFilter}**`);
    if (result.industryFilter) filters.push(`industry: **${result.industryFilter}**`);
    parts.push(`Filtered by ${filters.join(' and ')}.`);
  }

  parts.push(`Selected **${result.matchedLeadIds.length}** recipients.`);
  parts.push(`Subject and body have been auto-filled with merge fields.`);

  if (result.matchedLeadIds.length === 0) {
    parts.push(`\nNo leads matched your criteria — try broadening your filters or describe your audience differently.`);
  } else {
    parts.push(`\nYou can refine by sending another message, e.g. "make it shorter" or "also include warm leads".`);
  }

  return parts.join(' ');
}

export default function CampaignAIChat({ leads, industries, onApplyResult }: CampaignAIChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Describe your campaign and I\'ll auto-select recipients and draft the email. For example: "Send a cold outreach email to all SaaS leads about our integration platform"',
    },
  ]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);

    // Simulate slight delay for realism
    setTimeout(() => {
      const result = parsePrompt(text, leads, industries);
      const reply = buildAssistantMessage(result, leads);
      const assistantMsg: ChatMessage = { id: `a-${Date.now()}`, role: 'assistant', content: reply };

      setMessages(prev => [...prev, assistantMsg]);
      setIsThinking(false);
      onApplyResult(result);
    }, 600);
  };

  return (
    <div className="flex flex-col h-[360px] border rounded-lg bg-muted/30">
      {/* Chat messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot className="h-3.5 w-3.5 text-primary" />
              </div>
            )}
            <div
              className={`max-w-[75%] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background border text-foreground'
              }`}
            >
              {msg.content.split('**').map((part, i) =>
                i % 2 === 1 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}
        {isThinking && (
          <div className="flex gap-2.5">
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Bot className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="bg-background border rounded-lg px-3.5 py-2.5 text-sm text-muted-foreground">
              Thinking<span className="animate-pulse">...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t p-3 flex gap-2">
        <Input
          placeholder="Describe your campaign..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          className="h-9"
        />
        <Button size="sm" onClick={handleSend} disabled={!input.trim() || isThinking} className="gap-1.5 h-9 px-3">
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
