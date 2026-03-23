import { useAuth } from '@/contexts/AuthContext';
import { mockUsers } from '@/data/mockData';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Shield, Plug, Trash2 } from 'lucide-react';

export default function SettingsPage() {
  const { user, isAdmin } = useAuth();

  return (
    <div className="p-6 max-w-[800px] space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account and team</p>
      </div>

      {/* Profile */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" /> Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input defaultValue={user?.name} readOnly />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input defaultValue={user?.email} readOnly />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label>Role</Label>
            <Badge variant="secondary" className="capitalize">{user?.role}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Team (admin) */}
      {isAdmin && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" /> Team Management</CardTitle>
            <CardDescription>Manage employee accounts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {mockUsers.map(u => (
              <div key={u.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-medium">
                  {u.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{u.name}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
                <Badge variant="secondary" className="capitalize text-xs">{u.role}</Badge>
                {u.role !== 'admin' && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" className="mt-2">+ Add Team Member</Button>
          </CardContent>
        </Card>
      )}

      {/* Integrations */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Plug className="h-4 w-4" /> Integrations</CardTitle>
          <CardDescription>Connect your tools</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { name: 'Apollo.io', desc: 'Lead generation and enrichment', status: 'Coming Soon' },
            { name: 'Email Provider', desc: 'Connect Gmail, Outlook, or custom SMTP', status: 'Coming Soon' },
            { name: 'Slack', desc: 'Get notifications in your Slack workspace', status: 'Coming Soon' },
          ].map(int => (
            <div key={int.name} className="flex items-center gap-3 p-3 rounded-lg border">
              <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center text-muted-foreground text-xs font-bold">
                {int.name[0]}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{int.name}</p>
                <p className="text-xs text-muted-foreground">{int.desc}</p>
              </div>
              <Badge variant="outline" className="text-xs text-muted-foreground">{int.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
