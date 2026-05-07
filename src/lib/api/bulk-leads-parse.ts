import { supabase } from '@/lib/supabase';
import { FunctionsHttpError } from '@supabase/supabase-js';

/**
 * ParsedLead — output shape from `bulk-leads-parse` edge function after
 * server-side empty-string-sentinel stripping. `firstName` is guaranteed
 * non-empty; at least one of `email`/`phone` is guaranteed non-empty
 * (server-side filter mirrors the DB CHECK constraint).
 *
 * Wave C's `src/components/leads/add-lead/types.ts` re-exports these types
 * to avoid circular dependency risk.
 */
export interface ParsedLead {
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  company?: string;
  industry?: string;
  location?: string;
  linkedinUrl?: string;
  notes?: string;
}

export interface BulkParseResponse {
  leads: ParsedLead[];
  truncated: boolean;
}

interface EdgeErrorBody {
  error?: string;
  retryAfterSeconds?: number;
}

/**
 * Invoke the `bulk-leads-parse` edge function to extract structured leads
 * from messy unstructured text via OpenRouter (Sonnet 4.6, strict JSON).
 *
 * Errors are normalized into a thrown `Error`. For HTTP 429 the rate-limit
 * `retryAfterSeconds` is appended to the message so the UI can surface it.
 */
export async function parseLeadsFromText(
  text: string,
  signal?: AbortSignal
): Promise<BulkParseResponse> {
  const { data, error } = await supabase.functions.invoke<BulkParseResponse>(
    'bulk-leads-parse',
    {
      body: { text },
      ...(signal ? { signal } : {}),
    }
  );

  if (error) {
    // FunctionsHttpError exposes the underlying Response on `.context`.
    if (error instanceof FunctionsHttpError) {
      const response: Response | undefined = error.context;
      let body: EdgeErrorBody = {};
      try {
        if (response) body = (await response.json()) as EdgeErrorBody;
      } catch {
        // body wasn't JSON — fall through with empty object
      }

      if (response?.status === 429) {
        const retryAfter = body.retryAfterSeconds;
        const baseMsg = body.error || 'Rate limited';
        throw new Error(
          retryAfter !== undefined
            ? `${baseMsg} (retry in ${retryAfter}s)`
            : baseMsg
        );
      }

      throw new Error(body.error || error.message || 'Bulk parse failed');
    }

    // Network / relay / fetch errors — surface as-is.
    throw error instanceof Error ? error : new Error(String(error));
  }

  if (!data) throw new Error('Empty response from bulk-leads-parse');
  return data;
}
