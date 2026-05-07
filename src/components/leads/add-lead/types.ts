/**
 * Add-Lead dialog shared types.
 *
 * Re-exports the parse contract from the API layer (defined in Wave B at
 * `@/lib/api/bulk-leads-parse`) so the dialog components depend on a single,
 * stable type surface and avoid circular imports.
 */
export type { ParsedLead, BulkParseResponse } from '@/lib/api/bulk-leads-parse';

import type { Lead } from '@/types/crm';

/**
 * BulkInsertResponse — return shape of `useLeads().addLeadsAsync` (and the
 * underlying `createLeads` API). The dialog reads `skippedDuplicates` to
 * surface a toast describing rows the server rejected as duplicates.
 */
export interface BulkInsertResponse {
  inserted: Lead[];
  skippedDuplicates: string[];
}
