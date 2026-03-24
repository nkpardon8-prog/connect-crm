import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FlaskConical } from 'lucide-react';

interface ABVariantEditorProps {
  subject: string;
  body: string;
  onSubjectChange: (s: string) => void;
  onBodyChange: (b: string) => void;
}

export default function ABVariantEditor({ subject, body, onSubjectChange, onBodyChange }: ABVariantEditorProps) {
  return (
    <Card className="border border-dashed border-primary/30 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-primary" /> Variant B
          <span className="text-xs text-muted-foreground font-normal ml-auto">50% of recipients will receive this version</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">Subject</Label>
          <Input placeholder="Variant B subject line..." value={subject} onChange={e => onSubjectChange(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Body</Label>
          <Textarea placeholder="Variant B email body... Use {{firstName}} and {{company}}" value={body} onChange={e => onBodyChange(e.target.value)} className="min-h-[150px]" />
        </div>
        <p className="text-[10px] text-muted-foreground">Merge fields: {'{{firstName}}'}, {'{{company}}'}, {'{{unsubscribeLink}}'}</p>
      </CardContent>
    </Card>
  );
}
