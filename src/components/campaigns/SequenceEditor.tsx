import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Mail, Clock } from 'lucide-react';

interface SequenceStep {
  subject: string;
  body: string;
  delayDays: number;
}

interface SequenceEditorProps {
  introSubject: string;
  introBody: string;
  onIntroSubjectChange: (s: string) => void;
  onIntroBodyChange: (b: string) => void;
  followUps: SequenceStep[];
  onFollowUpsChange: (steps: SequenceStep[]) => void;
}

export default function SequenceEditor({
  introSubject, introBody, onIntroSubjectChange, onIntroBodyChange,
  followUps, onFollowUpsChange,
}: SequenceEditorProps) {
  const addStep = () => {
    if (followUps.length >= 4) return; // max 4 follow-ups + 1 intro = 5 total
    onFollowUpsChange([...followUps, { subject: '', body: '', delayDays: 3 }]);
  };

  const removeStep = (index: number) => {
    onFollowUpsChange(followUps.filter((_, i) => i !== index));
  };

  const updateStep = (index: number, field: keyof SequenceStep, value: string | number) => {
    const updated = [...followUps];
    updated[index] = { ...updated[index], [field]: value };
    onFollowUpsChange(updated);
  };

  return (
    <div className="space-y-4">
      {/* Step 0: Intro Email */}
      <Card className="border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Mail className="h-4 w-4" /> Step 1: Intro Email
            <span className="text-xs text-muted-foreground font-normal ml-auto">Sends immediately</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Subject</Label>
            <Input placeholder="Subject line..." value={introSubject} onChange={e => onIntroSubjectChange(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Body</Label>
            <Textarea placeholder="Email body... Use {{firstName}} and {{company}}" value={introBody} onChange={e => onIntroBodyChange(e.target.value)} className="min-h-[100px]" />
          </div>
          <p className="text-[10px] text-muted-foreground">Merge fields: {'{{firstName}}'}, {'{{company}}'}, {'{{unsubscribeLink}}'}</p>
        </CardContent>
      </Card>

      {/* Follow-up Steps */}
      {followUps.map((step, i) => (
        <Card key={i} className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" /> Step {i + 2}: Follow-up
              <div className="flex items-center gap-1 ml-auto">
                <span className="text-xs text-muted-foreground font-normal">Wait</span>
                <Input
                  type="number"
                  min={0}
                  max={30}
                  value={step.delayDays}
                  onChange={e => updateStep(i, 'delayDays', parseInt(e.target.value) || 0)}
                  className="w-16 h-7 text-xs text-center"
                />
                <span className="text-xs text-muted-foreground font-normal">days</span>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive ml-2" onClick={() => removeStep(i)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Subject</Label>
              <Input placeholder="Follow-up subject..." value={step.subject} onChange={e => updateStep(i, 'subject', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Body</Label>
              <Textarea placeholder="Follow-up body..." value={step.body} onChange={e => updateStep(i, 'body', e.target.value)} className="min-h-[80px]" />
            </div>
          </CardContent>
        </Card>
      ))}

      {followUps.length < 4 && (
        <Button variant="outline" size="sm" className="gap-1.5 w-full" onClick={addStep}>
          <Plus className="h-3.5 w-3.5" /> Add Follow-up Step ({followUps.length + 1}/5 total)
        </Button>
      )}
    </div>
  );
}
