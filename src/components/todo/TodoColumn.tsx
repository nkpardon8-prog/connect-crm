import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { TodoCard } from './TodoCard';
import type { Todo, User } from '@/types/crm';

interface TodoColumnProps {
  profileId: string;
  profile: User;
  todos: Todo[];
  projects: { id: string; title: string }[];
  onRemoveColumn: () => void;
}

const priorityOrder: Record<string, number> = { urgent: 0, normal: 1, low: 2 };

function sortActiveTodos(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    if (a.priority !== b.priority) return priorityOrder[a.priority] - priorityOrder[b.priority];
    const aTime = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const bTime = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    return aTime - bTime;
  });
}

export function TodoColumn({ profileId, profile, todos, projects, onRemoveColumn }: TodoColumnProps) {
  const [showAllCompleted, setShowAllCompleted] = useState(false);
  const { setNodeRef } = useDroppable({ id: profileId });

  const activeTodos = sortActiveTodos(todos.filter((t) => t.status === 'active'));
  const completedTodos = todos.filter((t) => t.status === 'completed');
  const visibleCompleted = showAllCompleted ? completedTodos : completedTodos.slice(0, 3);
  const hiddenCount = completedTodos.length - 3;

  const initials = profile.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  function projectName(projectId: string | null) {
    if (!projectId) return undefined;
    return projects.find((p) => p.id === projectId)?.title;
  }

  return (
    <div className="relative min-h-[400px] rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
          {initials}
        </div>
        <span className="text-sm font-medium">{profile.name}</span>
        <span className="ml-1 text-xs text-muted-foreground">({activeTodos.length})</span>
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 h-6 w-6 text-muted-foreground hover:text-foreground"
          onClick={onRemoveColumn}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div ref={setNodeRef} className="space-y-2">
        <SortableContext items={activeTodos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {activeTodos.map((todo) => (
            <TodoCard key={todo.id} todo={todo} projectName={projectName(todo.projectId)} />
          ))}
        </SortableContext>
      </div>

      {completedTodos.length > 0 && (
        <div className="mt-4">
          <Separator className="mb-3" />
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Completed ({completedTodos.length})
          </p>
          <div className="space-y-2">
            {visibleCompleted.map((todo) => (
              <TodoCard key={todo.id} todo={todo} projectName={projectName(todo.projectId)} />
            ))}
          </div>
          {hiddenCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-1 h-7 text-xs text-muted-foreground"
              onClick={() => setShowAllCompleted(!showAllCompleted)}
            >
              {showAllCompleted ? 'Show less' : `Show ${hiddenCount} more`}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
