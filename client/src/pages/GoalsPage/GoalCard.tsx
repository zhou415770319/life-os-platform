import { Pencil, Trash2, Calendar, CheckCircle2, Circle } from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import { Card } from '@client/src/components/ui/card';
import { Badge } from '@client/src/components/ui/badge';
import { Progress } from '@client/src/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@client/src/components/ui/alert-dialog';
import type { LifeGoal, Milestone } from '@shared/api.interface';

interface GoalCardProps {
  goal: LifeGoal;
  onEdit: (goal: LifeGoal) => void;
  onDelete: (goal: LifeGoal) => void;
  onToggleMilestone: (goalId: string, milestoneId: string, completed: boolean) => void;
}

export function GoalCard({ goal, onEdit, onDelete, onToggleMilestone }: GoalCardProps) {
  return (
    <Card className="glass-card glass-card-hover transition-all duration-300 p-6 hover:shadow-xl">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-semibold text-zinc-50 truncate">{goal.title}</h3>
            {goal.category && (
              <Badge variant="outline" className="text-xs">
                {goal.category}
              </Badge>
            )}
          </div>
          {goal.description && (
            <p className="mt-1 text-sm text-zinc-400 line-clamp-2">{goal.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(goal)}
            aria-label="编辑目标"
          >
            <Pencil className="h-4 w-4 text-zinc-400" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="删除目标">
                <Trash2 className="h-4 w-4 text-zinc-400 hover:text-destructive" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="glass-card !bg-background/90 backdrop-blur-xl">
              <AlertDialogHeader>
                <AlertDialogTitle>确认删除目标？</AlertDialogTitle>
                <AlertDialogDescription>
                  此操作不可撤销，目标「{goal.title}」及其所有里程碑将被永久删除。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive hover:bg-destructive/90"
                  onClick={() => onDelete(goal)}
                >
                  确认删除
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between text-xs text-zinc-400 mb-1.5">
          <span>进度</span>
          <span className="font-medium text-zinc-300">{goal.progress}%</span>
        </div>
        <Progress value={goal.progress} className="h-1.5" />
      </div>

      {goal.deadline && (
        <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-4">
          <Calendar className="h-3.5 w-3.5" />
          <span>截止：{goal.deadline}</span>
        </div>
      )}

      {goal.milestones && goal.milestones.length > 0 && (
        <div className="space-y-2 pt-3 border-t border-white/5">
          <p className="text-xs text-zinc-500 font-medium">里程碑</p>
          <ul className="space-y-1.5">
            {goal.milestones.map((ms: Milestone) => (
              <li key={ms.id}>
                <button
                  type="button"
                  onClick={() => onToggleMilestone(goal.id, ms.id, !ms.completed)}
                  className="flex items-center gap-2 w-full text-left group"
                >
                  {ms.completed ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400 shrink-0" />
                  )}
                  <span
                    className={`text-sm ${ms.completed ? 'text-zinc-500 line-through' : 'text-zinc-300'}`}
                  >
                    {ms.title}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
