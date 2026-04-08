import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { ProjectDetailSheet } from './ProjectDetailSheet';
import type { Project, Todo, User } from '@/types/crm';

interface Props {
  project: Project;
  todos: Todo[];
  profiles: User[];
}

const statusStyles: Record<string, string> = {
  active: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  archived: 'bg-gray-100 text-gray-800',
};

export function ProjectCard({ project, todos, profiles }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const completedCount = todos.filter((t) => t.status === 'completed').length;
  const progress = todos.length > 0 ? Math.round((completedCount / todos.length) * 100) : 0;

  const teamMembers = useMemo(() => {
    const profileMap = new Map(profiles.map((p) => [p.id, p]));
    const uniqueIds = [...new Set(todos.map((t) => t.assignedTo).filter(Boolean))] as string[];
    return uniqueIds.map((id) => profileMap.get(id)).filter(Boolean) as User[];
  }, [todos, profiles]);

  const displayMembers = teamMembers.slice(0, 4);
  const overflow = teamMembers.length - 4;

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card
          className="cursor-pointer border shadow-sm transition-shadow hover:shadow-md"
          onClick={() => setSheetOpen(true)}
        >
          <CardContent className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold">{project.title}</h3>
              <Badge variant="secondary" className={cn('shrink-0 text-xs', statusStyles[project.status])}>
                {project.status}
              </Badge>
            </div>

            {project.goal && (
              <p className="line-clamp-2 text-xs text-muted-foreground">{project.goal}</p>
            )}

            <div className="space-y-1">
              <Progress value={progress} className="h-1.5" />
              <p className="text-xs text-muted-foreground">
                {completedCount}/{todos.length} tasks complete
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex -space-x-2">
                {displayMembers.map((m) => (
                  <div
                    key={m.id}
                    className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-medium"
                    title={m.name}
                  >
                    {m.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                ))}
                {overflow > 0 && (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-medium">
                    +{overflow}
                  </div>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {format(parseISO(project.createdAt), 'MMM d, yyyy')}
              </span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <ProjectDetailSheet
        project={project}
        todos={todos}
        profiles={profiles}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  );
}
