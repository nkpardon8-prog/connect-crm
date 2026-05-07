import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Lead, LeadStatus } from '@/types/crm';

interface ManualFormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobTitle: string;
  company: string;
  companySize: string;
  industry: string;
  location: string;
  linkedinUrl: string;
  status: LeadStatus;
  notes: string;
}

const INITIAL_STATE: ManualFormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  jobTitle: '',
  company: '',
  companySize: '',
  industry: '',
  location: '',
  linkedinUrl: '',
  status: 'cold',
  notes: '',
};

/**
 * Co-located validator. Mirrors the DB CHECK constraint
 * `leads_first_name_and_contact_required`: firstName is required, and
 * at least one of email/phone must be provided.
 */
function validateManualLead(form: ManualFormState): { ok: boolean; reason?: string } {
  if (!form.firstName.trim()) return { ok: false, reason: 'First name is required' };
  if (!form.email.trim() && !form.phone.trim())
    return { ok: false, reason: 'Email or phone is required' };
  return { ok: true };
}

interface ManualLeadFormProps {
  onSubmit: (lead: Omit<Lead, 'id' | 'createdAt'>) => Promise<void>;
  onCancel: () => void;
}

export function ManualLeadForm({ onSubmit, onCancel }: ManualLeadFormProps) {
  const [form, setForm] = useState<ManualFormState>(INITIAL_STATE);
  const [submitting, setSubmitting] = useState(false);

  const valid = validateManualLead(form).ok;

  function update<K extends keyof ManualFormState>(key: K, value: ManualFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      const lead: Omit<Lead, 'id' | 'createdAt'> = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim() || undefined,
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        jobTitle: form.jobTitle.trim() || undefined,
        company: form.company.trim() || undefined,
        companySize: form.companySize.trim() || undefined,
        industry: form.industry.trim(),
        location: form.location.trim(),
        status: form.status || 'cold',
        notes: form.notes.trim(),
        tags: [],
        assignedTo: null,
        lastContactedAt: null,
        linkedinUrl: form.linkedinUrl.trim() || undefined,
      };
      await onSubmit(lead);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="manual-first-name">
            First Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="manual-first-name"
            value={form.firstName}
            onChange={(e) => update('firstName', e.target.value)}
            placeholder="Jane"
          />
        </div>
        <div>
          <Label htmlFor="manual-last-name">Last Name</Label>
          <Input
            id="manual-last-name"
            value={form.lastName}
            onChange={(e) => update('lastName', e.target.value)}
            placeholder="Doe"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="manual-email">Email</Label>
          <Input
            id="manual-email"
            type="email"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            placeholder="jane@example.com"
          />
        </div>
        <div>
          <Label htmlFor="manual-phone">Phone</Label>
          <Input
            id="manual-phone"
            value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
            placeholder="+1 555 123 4567"
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Email or phone is required.</p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="manual-job-title">Job Title</Label>
          <Input
            id="manual-job-title"
            value={form.jobTitle}
            onChange={(e) => update('jobTitle', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="manual-company">Company</Label>
          <Input
            id="manual-company"
            value={form.company}
            onChange={(e) => update('company', e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="manual-company-size">Company Size</Label>
          <Input
            id="manual-company-size"
            value={form.companySize}
            onChange={(e) => update('companySize', e.target.value)}
            placeholder="11-50"
          />
        </div>
        <div>
          <Label htmlFor="manual-industry">Industry</Label>
          <Input
            id="manual-industry"
            value={form.industry}
            onChange={(e) => update('industry', e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="manual-location">Location</Label>
          <Input
            id="manual-location"
            value={form.location}
            onChange={(e) => update('location', e.target.value)}
            placeholder="San Francisco, CA"
          />
        </div>
        <div>
          <Label htmlFor="manual-linkedin">LinkedIn URL</Label>
          <Input
            id="manual-linkedin"
            value={form.linkedinUrl}
            onChange={(e) => update('linkedinUrl', e.target.value)}
            placeholder="https://linkedin.com/in/..."
          />
        </div>
      </div>

      <div>
        <Label>Status</Label>
        <Select
          value={form.status}
          onValueChange={(v) => update('status', v as LeadStatus)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cold">Cold</SelectItem>
            <SelectItem value="lukewarm">Lukewarm</SelectItem>
            <SelectItem value="warm">Warm</SelectItem>
            <SelectItem value="dead">Dead</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="manual-notes">Notes</Label>
        <Textarea
          id="manual-notes"
          value={form.notes}
          onChange={(e) => update('notes', e.target.value)}
          rows={3}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={!valid || submitting}>
          {submitting ? 'Adding…' : 'Add Lead'}
        </Button>
      </div>
    </div>
  );
}
