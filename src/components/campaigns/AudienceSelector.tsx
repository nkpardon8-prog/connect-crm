import { useState, useMemo } from 'react';
import type { Lead } from '@/types/crm';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Users } from 'lucide-react';

interface AudienceSelectorProps {
  leads: Lead[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  unsubscribedEmails?: Set<string>;
}

export default function AudienceSelector({ leads, selectedIds, onSelectionChange, unsubscribedEmails = new Set() }: AudienceSelectorProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [industryFilter, setIndustryFilter] = useState('all');

  const industries = useMemo(() =>
    [...new Set(leads.map(l => l.industry).filter(Boolean))].sort(),
    [leads]
  );

  const filtered = useMemo(() => {
    return leads.filter(l => {
      if (unsubscribedEmails.has(l.email)) return false;
      if (statusFilter !== 'all' && l.status !== statusFilter) return false;
      if (industryFilter !== 'all' && l.industry !== industryFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return l.firstName.toLowerCase().includes(q) || l.lastName.toLowerCase().includes(q) || l.company.toLowerCase().includes(q) || l.email.toLowerCase().includes(q);
      }
      return true;
    });
  }, [leads, statusFilter, industryFilter, search, unsubscribedEmails]);

  const allSelected = filtered.length > 0 && filtered.every(l => selectedIds.has(l.id));

  const toggleAll = () => {
    const next = new Set(selectedIds);
    if (allSelected) { filtered.forEach(l => next.delete(l.id)); }
    else { filtered.forEach(l => next.add(l.id)); }
    onSelectionChange(next);
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    onSelectionChange(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search leads..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="cold">Cold</SelectItem>
            <SelectItem value="lukewarm">Lukewarm</SelectItem>
            <SelectItem value="warm">Warm</SelectItem>
          </SelectContent>
        </Select>
        <Select value={industryFilter} onValueChange={setIndustryFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Industry" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Industries</SelectItem>
            {industries.map(ind => <SelectItem key={ind} value={ind}>{ind}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {filtered.length} leads available</span>
        <Badge variant="secondary" className="text-xs">{selectedIds.size} selected</Badge>
      </div>
      <div className="border rounded-lg max-h-[350px] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]"><Checkbox checked={allSelected} onCheckedChange={toggleAll} /></TableHead>
              <TableHead className="text-xs">Name</TableHead>
              <TableHead className="text-xs">Company</TableHead>
              <TableHead className="text-xs">Industry</TableHead>
              <TableHead className="text-xs">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.slice(0, 100).map(l => (
              <TableRow key={l.id} className="cursor-pointer" onClick={() => toggleOne(l.id)}>
                <TableCell><Checkbox checked={selectedIds.has(l.id)} /></TableCell>
                <TableCell className="text-xs font-medium">{l.firstName} {l.lastName}</TableCell>
                <TableCell className="text-xs">{l.company}</TableCell>
                <TableCell className="text-xs">{l.industry}</TableCell>
                <TableCell><Badge variant="secondary" className="text-[10px] capitalize">{l.status}</Badge></TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-6">No leads match your filters</TableCell></TableRow>
            )}
            {filtered.length > 100 && (
              <TableRow><TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-2">Showing first 100 of {filtered.length} leads. Use filters to narrow results.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
