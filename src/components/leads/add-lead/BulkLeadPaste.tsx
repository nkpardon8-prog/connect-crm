import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { parseLeadsFromText } from '@/lib/api/bulk-leads-parse';
import type { BulkParseResponse } from './types';

const MAX_INPUT_BYTES = 50_000;
const PARSE_TIMEOUT_MS = 90_000;

interface BulkLeadPasteProps {
  text: string;
  setText: (v: string) => void;
  onParsed: (result: BulkParseResponse) => void;
  isParsing: boolean;
  setIsParsing: (v: boolean) => void;
}

export function BulkLeadPaste({
  text,
  setText,
  onParsed,
  isParsing,
  setIsParsing,
}: BulkLeadPasteProps) {
  const byteLength = new TextEncoder().encode(text).byteLength;

  async function handleProcess() {
    if (isParsing) return;
    if (!text.trim()) {
      toast.error('Paste some lead data first');
      return;
    }
    if (byteLength > MAX_INPUT_BYTES) {
      toast.error('Input too large — paste at most ~100 leads worth of data');
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), PARSE_TIMEOUT_MS);

    setIsParsing(true);
    try {
      const result = await parseLeadsFromText(text, controller.signal);
      if (!result.leads || result.leads.length === 0) {
        toast.error('No leads detected — try a clearer paste or smaller batch');
        return;
      }
      onParsed(result);
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === 'AbortError'
          ? 'Took too long — try a smaller batch'
          : err instanceof Error
            ? err.message
            : 'Failed to parse leads';
      toast.error(message);
    } finally {
      window.clearTimeout(timeoutId);
      setIsParsing(false);
    }
  }

  const overLimit = byteLength > MAX_INPUT_BYTES;

  return (
    <div className="space-y-3">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="paste any messy lead data — names, emails, phones, anything"
        rows={12}
        className="font-mono text-sm"
        disabled={isParsing}
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>~100 leads max per paste</span>
        <span className={overLimit ? 'text-red-500' : undefined}>
          {byteLength.toLocaleString()} / {MAX_INPUT_BYTES.toLocaleString()} bytes
        </span>
      </div>

      <div className="flex items-center justify-end gap-3">
        {isParsing && (
          <span className="text-xs text-muted-foreground">
            This may take up to a minute…
          </span>
        )}
        <Button
          onClick={handleProcess}
          disabled={isParsing || !text.trim() || overLimit}
        >
          {isParsing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing
            </>
          ) : (
            'Process'
          )}
        </Button>
      </div>
    </div>
  );
}
