import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api/todos';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Todo, TodoComment, TodoActivityEntry, TodoColumn, TodoActionType } from '@/types/crm';

export function useTodos() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: todos = [], isLoading, error } = useQuery({
    queryKey: ['todos'],
    queryFn: api.getTodos,
  });

  useEffect(() => {
    const channel = supabase
      .channel('todos-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todos' }, () => {
        queryClient.invalidateQueries({ queryKey: ['todos'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const createTodoMutation = useMutation({
    mutationFn: (todo: Omit<Todo, 'id' | 'createdAt' | 'updatedAt' | 'completedAt'>) =>
      api.createTodo(todo),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
  });

  const batchCreateTodosMutation = useMutation({
    mutationFn: (todos: Omit<Todo, 'id' | 'createdAt' | 'updatedAt' | 'completedAt'>[]) =>
      api.batchCreateTodos(todos),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
  });

  const updateTodoMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Todo> }) =>
      api.updateTodo(id, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
  });

  const deleteTodoMutation = useMutation({
    mutationFn: (id: string) => api.deleteTodo(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
  });

  const logActivityMutation = useMutation({
    mutationFn: ({ todoId, actorId, actionType, details }: {
      todoId: string; actorId: string; actionType: TodoActionType; details?: Record<string, unknown>;
    }) => api.logTodoActivity(todoId, actorId, actionType, details),
  });

  function createRecurringTodo(completedTodo: Todo) {
    if (!completedTodo.recurrencePattern) return;
    const nextDueDate = api.calculateNextDueDate(completedTodo.dueDate, completedTodo.recurrencePattern);
    createTodoMutation.mutate({
      title: completedTodo.title,
      summary: completedTodo.summary,
      details: completedTodo.details,
      priority: completedTodo.priority,
      dueDate: nextDueDate,
      status: 'active',
      assignedTo: completedTodo.assignedTo,
      createdBy: user?.id || completedTodo.createdBy,
      projectId: completedTodo.projectId,
      isPinned: false,
      isRecurring: true,
      recurrencePattern: completedTodo.recurrencePattern,
      parentTodoId: completedTodo.id,
      position: 0,
    });
  }

  return {
    todos,
    isLoading,
    error,
    createTodo: (todo: Omit<Todo, 'id' | 'createdAt' | 'updatedAt' | 'completedAt'>) =>
      createTodoMutation.mutateAsync(todo),
    batchCreateTodos: (todos: Omit<Todo, 'id' | 'createdAt' | 'updatedAt' | 'completedAt'>[]) =>
      batchCreateTodosMutation.mutateAsync(todos),
    updateTodo: (id: string, updates: Partial<Todo>) =>
      updateTodoMutation.mutate({ id, updates }),
    deleteTodo: (id: string) => deleteTodoMutation.mutate(id),
    logActivity: (todoId: string, actorId: string, actionType: TodoActionType, details?: Record<string, unknown>) =>
      logActivityMutation.mutate({ todoId, actorId, actionType, details }),
    createRecurringTodo,
  };
}

export function useTodoColumns() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: columns = [], isLoading } = useQuery({
    queryKey: ['todo-columns', user?.id],
    queryFn: () => api.getTodoColumns(user!.id),
    enabled: !!user,
  });

  useEffect(() => {
    const channel = supabase
      .channel('todo-columns-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todo_columns' }, () => {
        queryClient.invalidateQueries({ queryKey: ['todo-columns'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const addColumnMutation = useMutation({
    mutationFn: ({ profileId, position }: { profileId: string; position: number }) =>
      api.addTodoColumn(user!.id, profileId, position),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todo-columns'] }),
  });

  const removeColumnMutation = useMutation({
    mutationFn: (id: string) => api.removeTodoColumn(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todo-columns'] }),
  });

  return {
    columns,
    isLoading,
    addColumn: (profileId: string) =>
      addColumnMutation.mutate({ profileId, position: columns.length }),
    removeColumn: (id: string) => removeColumnMutation.mutate(id),
  };
}

export function useTodoComments(todoId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['todo-comments', todoId],
    queryFn: () => api.getTodoComments(todoId),
    enabled: !!todoId,
  });

  useEffect(() => {
    const channel = supabase
      .channel(`todo-comments-${todoId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'todo_comments',
        filter: `todo_id=eq.${todoId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['todo-comments', todoId] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient, todoId]);

  const addCommentMutation = useMutation({
    mutationFn: (content: string) =>
      api.addTodoComment(todoId, user!.id, content),
    onSuccess: (_data, content) => {
      queryClient.invalidateQueries({ queryKey: ['todo-comments', todoId] });
      api.logTodoActivity(todoId, user!.id, 'commented', { content });
    },
  });

  return {
    comments,
    isLoading,
    addComment: (content: string) => addCommentMutation.mutate(content),
  };
}

export function useTodoActivity(todoId: string) {
  const queryClient = useQueryClient();

  const { data: activity = [], isLoading } = useQuery({
    queryKey: ['todo-activity', todoId],
    queryFn: () => api.getTodoActivity(todoId),
    enabled: !!todoId,
  });

  useEffect(() => {
    const channel = supabase
      .channel(`todo-activity-${todoId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'todo_activity',
        filter: `todo_id=eq.${todoId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['todo-activity', todoId] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient, todoId]);

  return { activity, isLoading };
}
