import { useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLeads } from '@/hooks/use-leads';
import type { Lead } from '@/types/crm';
import { ManualLeadForm } from './ManualLeadForm';
import { BulkLeadPaste } from './BulkLeadPaste';
import { BulkLeadReviewTable } from './BulkLeadReviewTable';
import type { ParsedLead } from './types';

export function AddLeadDialog() {
  const { user } = useAuth();
  const { addLeadsAsync } = useLeads();

  const [open, setOpen] = useState(false);

  // Bulk-tab state machine — held at the orchestrator level so a parse error
  // preserves textarea contents and so tab switches don't reset bulk progress.
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<ParsedLead[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function resetBulkState() {
    setText('');
    setParsed(null);
    setTruncated(false);
    setIsParsing(false);
    setSubmitting(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      // Reset BOTH manual (ManualLeadForm unmounts and clears its own state)
      // AND bulk state machine. Tab switches do NOT reset; only dialog close.
      resetBulkState();
    }
  }

  async function handleManualSubmit(lead: Omit<Lead, 'id' | 'createdAt'>) {
    try {
      const { skippedDuplicates } = await addLeadsAsync([lead]);
      if (skippedDuplicates.length > 0) {
        toast.info('Lead already exists', { description: skippedDuplicates[0] });
      } else {
        toast.success('Lead added');
      }
      setOpen(false);
      resetBulkState();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add lead');
    }
  }

  async function handleBulkSubmit(leads: Omit<Lead, 'id' | 'createdAt'>[]) {
    setSubmitting(true);
    try {
      const { inserted, skippedDuplicates } = await addLeadsAsync(leads);
      const insertedCount = inserted.length;
      const skippedCount = skippedDuplicates.length;

      if (skippedCount > 0) {
        const preview = skippedDuplicates.slice(0, 5).join(', ');
        const more = skippedCount > 5 ? `, +${skippedCount - 5} more` : '';
        toast.success(
          `Added ${insertedCount} lead${insertedCount === 1 ? '' : 's'}. ${skippedCount} skipped: ${preview}${more}`,
        );
      } else {
        toast.success(`Added ${insertedCount} lead${insertedCount === 1 ? '' : 's'}`);
      }

      setOpen(false);
      resetBulkState();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add leads');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button disabled={!user}>
          <Plus className="h-4 w-4 mr-2" /> Add Lead
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Add Lead</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="manual" className="mt-2">
          <TabsList>
            <TabsTrigger value="manual">Manual</TabsTrigger>
            <TabsTrigger value="bulk">Bulk Paste</TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="mt-4">
            <ManualLeadForm
              onSubmit={handleManualSubmit}
              onCancel={() => setOpen(false)}
            />
          </TabsContent>

          <TabsContent value="bulk" className="mt-4">
            {parsed === null ? (
              <BulkLeadPaste
                text={text}
                setText={setText}
                onParsed={(result) => {
                  setParsed(result.leads);
                  setTruncated(result.truncated);
                }}
                isParsing={isParsing}
                setIsParsing={setIsParsing}
              />
            ) : (
              <BulkLeadReviewTable
                rows={parsed}
                setRows={setParsed}
                truncated={truncated}
                onSubmit={handleBulkSubmit}
                submitting={submitting}
              />
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
