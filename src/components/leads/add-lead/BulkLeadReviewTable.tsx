import { X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Lead } from '@/types/crm';
import type { ParsedLead } from './types';

interface BulkLeadReviewTableProps {
  rows: ParsedLead[];
  setRows: (rows: ParsedLead[]) => void;
  truncated: boolean;
  onSubmit: (leads: Omit<Lead, 'id' | 'createdAt'>[]) => Promise<void>;
  submitting: boolean;
}

function isEligible(row: ParsedLead): boolean {
  const hasFirst = !!row.firstName?.trim();
  const hasContact = !!row.email?.trim() || !!row.phone?.trim();
  return hasFirst && hasContact;
}

const FIELDS: Array<{
  key: keyof Pick<
    ParsedLead,
    'firstName' | 'lastName' | 'email' | 'phone' | 'jobTitle' | 'company' | 'industry' | 'location'
  >;
  label: string;
}> = [
  { key: 'firstName', label: 'First Name' },
  { key: 'lastName', label: 'Last Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'jobTitle', label: 'Job Title' },
  { key: 'company', label: 'Company' },
  { key: 'industry', label: 'Industry' },
  { key: 'location', label: 'Location' },
];

export function BulkLeadReviewTable({
  rows,
  setRows,
  truncated,
  onSubmit,
  submitting,
}: BulkLeadReviewTableProps) {
  const eligibleRows = rows.filter(isEligible);
  const eligibleCount = eligibleRows.length;
  const skippedCount = rows.length - eligibleCount;

  function updateCell(index: number, key: keyof ParsedLead, value: string) {
    const next = rows.map((row, i) =>
      i === index ? { ...row, [key]: value } : row,
    );
    setRows(next);
  }

  function removeRow(index: number) {
    setRows(rows.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (submitting || eligibleCount === 0) return;

    const leads: Omit<Lead, 'id' | 'createdAt'>[] = eligibleRows.map((row) => ({
      firstName: row.firstName!.trim(),
      lastName: row.lastName?.trim() || undefined,
      email: (row.email ?? '').trim().toLowerCase(),
      phone: (row.phone ?? '').trim(),
      jobTitle: row.jobTitle?.trim() || undefined,
      company: row.company?.trim() || undefined,
      companySize: undefined,
      industry: (row.industry ?? '').trim(),
      location: (row.location ?? '').trim(),
      linkedinUrl: row.linkedinUrl?.trim() || undefined,
      status: 'cold',
      notes: (row.notes ?? '').trim(),
      tags: [],
      assignedTo: null,
      lastContactedAt: null,
    }));

    if (skippedCount > 0) {
      toast.info(`Skipped ${skippedCount} incomplete row${skippedCount === 1 ? '' : 's'}`);
    }

    await onSubmit(leads);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">Does this look good?</h3>
          <p className="text-xs text-muted-foreground">
            {eligibleCount} lead{eligibleCount === 1 ? '' : 's'} ready
            {skippedCount > 0 && ` · ${skippedCount} incomplete (will skip)`}
          </p>
        </div>
        {truncated && (
          <Badge variant="outline" className="border-yellow-500 text-yellow-600">
            +truncated to 100
          </Badge>
        )}
      </div>

      <div className="max-h-[420px] overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {FIELDS.map((f) => (
                <TableHead key={f.key} className="whitespace-nowrap">
                  {f.label}
                </TableHead>
              ))}
              <TableHead className="w-10" aria-label="Remove" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => {
              const eligible = isEligible(row);
              return (
                <TableRow
                  key={index}
                  className={!eligible ? 'bg-yellow-50/50' : undefined}
                >
                  {FIELDS.map((f) => (
                    <TableCell key={f.key} className="p-1 align-middle">
                      <Input
                        value={row[f.key] ?? ''}
                        onChange={(e) => updateCell(index, f.key, e.target.value)}
                        className="h-8 text-sm"
                      />
                    </TableCell>
                  ))}
                  <TableCell className="p-1 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => removeRow(index)}
                      aria-label="Remove row"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end gap-2">
        <Button
          onClick={handleSubmit}
          disabled={submitting || eligibleCount === 0}
        >
          {submitting ? 'Adding…' : `Add ${eligibleCount} lead${eligibleCount === 1 ? '' : 's'}`}
        </Button>
      </div>
    </div>
  );
}
