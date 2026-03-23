import { useParams, useNavigate } from 'react-router-dom';
import { useCRM } from '@/contexts/CRMContext';
import { useAuth } from '@/contexts/AuthContext';
import { mockUsers } from '@/data/mockData';
import type { LeadStatus, ActivityType } from '@/types/crm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Phone, Mail, MapPin, Building2, Users, Linkedin, Sparkles, Clock, MessageSquare, PhoneCall, MailOpen, Tag, X } from 'lucide-react';
import { useState } from 'react';

const statusConfig: Record<LeadStatus, { label: string; className: string }> = {
  cold: { label: 'Cold', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  lukewarm: { label: 'Lukewarm', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  warm: { label: 'Warm', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  dead: { label: 'Dead', className: 'bg-red-100 text-red-700 border-red-200' },
};

const activityIcons: Record<ActivityType, React.ElementType> = {
  call: PhoneCall,
  email_sent: MailOpen,
  email_received: Mail,
  note: MessageSquare,
  status_change: Tag,
  meeting: Users,
};

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { leads, activities, suggestions, updateLead, addActivity, dismissSuggestion } = useCRM();
  const { user } = useAuth();
  const [newNote, setNewNote] = useState('');

  const lead = leads.find(l => l.id === id);
  if (!lead) return <div className="p-6">Lead not found</div>;

  const leadActivities = activities.filter(a => a.leadId === id).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const leadSuggestions = suggestions.filter(s => s.leadId === id && !s.dismissed);
  const assignedUser = mockUsers.find(u => u.id === lead.assignedTo);

  const handleStatusChange = (status: LeadStatus) => {
    updateLead(lead.id, { status });
    addActivity({
      id: `a-${Date.now()}`,
      leadId: lead.id,
      userId: user!.id,
      type: 'status_change',
      description: `Status changed to ${statusConfig[status].label}`,
      timestamp: new Date().toISOString(),
    });
  };

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    addActivity({
      id: `a-${Date.now()}`,
      leadId: lead.id,
      userId: user!.id,
      type: 'note',
      description: newNote.trim(),
      timestamp: new Date().toISOString(),
    });
    setNewNote('');
  };

  const handleCall = () => {
    addActivity({
      id: `a-${Date.now()}`,
      leadId: lead.id,
      userId: user!.id,
      type: 'call',
      description: 'Outbound call initiated',
      timestamp: new Date().toISOString(),
    });
    updateLead(lead.id, { lastContactedAt: new Date().toISOString() });
    window.location.href = `tel:${lead.phone}`;
  };

  const handleEmailClick = () => {
    addActivity({
      id: `a-${Date.now()}`,
      leadId: lead.id,
      userId: user!.id,
      type: 'email_sent',
      description: 'Email initiated',
      timestamp: new Date().toISOString(),
    });
    updateLead(lead.id, { lastContactedAt: new Date().toISOString() });
    window.location.href = `mailto:${lead.email}`;
  };

  return (
    <div className="p-6 max-w-[1200px] space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/leads')} className="gap-1.5 text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to leads
      </Button>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Contact Card */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="border shadow-sm">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">{lead.firstName} {lead.lastName}</h2>
                  <p className="text-sm text-muted-foreground">{lead.jobTitle}</p>
                </div>
                <Select value={lead.status} onValueChange={(v) => handleStatusChange(v as LeadStatus)}>
                  <SelectTrigger className="w-auto">
                    <Badge variant="outline" className={statusConfig[lead.status].className}>
                      {statusConfig[lead.status].label}
                    </Badge>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusConfig).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="h-4 w-4 flex-shrink-0" />
                  <span>{lead.company} · {lead.companySize} employees</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4 flex-shrink-0" />
                  <span>{lead.location}</span>
                </div>
                <button onClick={handleCall} className="flex items-center gap-2 text-primary hover:underline w-full">
                  <Phone className="h-4 w-4 flex-shrink-0" />
                  <span>{lead.phone}</span>
                </button>
                <button onClick={handleEmailClick} className="flex items-center gap-2 text-primary hover:underline w-full truncate">
                  <Mail className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{lead.email}</span>
                </button>
                {lead.linkedinUrl && (
                  <a href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline">
                    <Linkedin className="h-4 w-4 flex-shrink-0" />
                    <span>LinkedIn Profile</span>
                  </a>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
                <span>Assigned to {assignedUser?.name}</span>
              </div>

              {lead.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {lead.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Suggestions */}
          {leadSuggestions.length > 0 && (
            <Card className="border shadow-sm border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" /> AI Action Items
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {leadSuggestions.map(s => (
                  <div key={s.id} className="flex items-start gap-2 p-2 rounded-md bg-primary/5 text-sm">
                    <div className="flex-1">{s.suggestion}</div>
                    <Button variant="ghost" size="icon" className="h-5 w-5 flex-shrink-0" onClick={() => dismissSuggestion(s.id)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Activity + Notes */}
        <div className="lg:col-span-2 space-y-4">
          {/* Add note */}
          <Card className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex gap-2">
                <Textarea placeholder="Add a note..." value={newNote} onChange={e => setNewNote(e.target.value)} className="min-h-[60px]" />
                <Button onClick={handleAddNote} disabled={!newNote.trim()} className="self-end">Add</Button>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {leadActivities.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No activity recorded yet</p>
              ) : (
                <div className="space-y-0">
                  {leadActivities.map((act, i) => {
                    const Icon = activityIcons[act.type];
                    const actUser = mockUsers.find(u => u.id === act.userId);
                    return (
                      <div key={act.id} className="flex gap-3 py-3 relative">
                        {i < leadActivities.length - 1 && (
                          <div className="absolute left-[15px] top-[40px] bottom-0 w-px bg-border" />
                        )}
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 relative z-10">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground">{act.description}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {new Date(act.timestamp).toLocaleString()} · {actUser?.name}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
