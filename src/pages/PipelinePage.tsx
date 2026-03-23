import { useAuth } from '@/contexts/AuthContext';
import { useDeals } from '@/hooks/use-deals';
import { useLeads } from '@/hooks/use-leads';
import { useProfiles } from '@/hooks/use-profiles';
import type { DealStage, Deal } from '@/types/crm';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign } from 'lucide-react';
import { useState } from 'react';

const stages: { key: DealStage; label: string; color: string }[] = [
  { key: 'new', label: 'New', color: 'bg-slate-100' },
  { key: 'contacted', label: 'Contacted', color: 'bg-blue-50' },
  { key: 'qualified', label: 'Qualified', color: 'bg-amber-50' },
  { key: 'proposal', label: 'Proposal', color: 'bg-orange-50' },
  { key: 'negotiation', label: 'Negotiation', color: 'bg-purple-50' },
  { key: 'closed_won', label: 'Closed Won', color: 'bg-emerald-50' },
  { key: 'closed_lost', label: 'Closed Lost', color: 'bg-red-50' },
];

export default function PipelinePage() {
  const { deals, updateDeal, isLoading: dealsLoading } = useDeals();
  const { leads } = useLeads();
  const { profiles } = useProfiles();
  const { isAdmin } = useAuth();
  const [draggedDeal, setDraggedDeal] = useState<string | null>(null);

  const totalPipeline = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage)).reduce((s, d) => s + d.value, 0);

  const handleDragStart = (dealId: string) => setDraggedDeal(dealId);
  const handleDragEnd = () => setDraggedDeal(null);
  const handleDrop = (stage: DealStage) => {
    if (draggedDeal) {
      updateDeal(draggedDeal, { stage });
      setDraggedDeal(null);
    }
  };

  const getLeadName = (leadId: string) => {
    const lead = leads.find(l => l.id === leadId);
    return lead ? `${lead.firstName} ${lead.lastName}` : 'Unknown';
  };

  if (dealsLoading) {
    return <div className="p-6 flex items-center justify-center min-h-[50vh]"><div className="text-sm text-muted-foreground">Loading...</div></div>;
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Pipeline</h1>
          <p className="text-sm text-muted-foreground">{deals.length} deals · ${totalPipeline.toLocaleString()} active pipeline</p>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {stages.map(stage => {
          const stageDeals = deals.filter(d => d.stage === stage.key);
          const stageTotal = stageDeals.reduce((s, d) => s + d.value, 0);
          return (
            <div
              key={stage.key}
              className="flex-shrink-0 w-[240px]"
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleDrop(stage.key)}
            >
              <div className={`rounded-lg ${stage.color} p-3 min-h-[400px]`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">{stage.label}</h3>
                  <Badge variant="secondary" className="text-[10px]">{stageDeals.length}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-3">${stageTotal.toLocaleString()}</p>
                <div className="space-y-2">
                  {stageDeals.map(deal => (
                    <Card
                      key={deal.id}
                      className="border shadow-sm cursor-grab active:cursor-grabbing bg-background"
                      draggable
                      onDragStart={() => handleDragStart(deal.id)}
                      onDragEnd={handleDragEnd}
                    >
                      <CardContent className="p-3">
                        <p className="text-sm font-medium text-foreground leading-tight">{deal.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">{getLeadName(deal.leadId)}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-sm font-semibold text-primary flex items-center gap-0.5">
                            <DollarSign className="h-3.5 w-3.5" />{deal.value.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {isAdmin ? profiles.find(p => p.id === deal.assignedTo)?.name?.split(' ')[0] : ''}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
