import { Card, CardContent } from '@client/src/components/ui/card';
import { Badge } from '@client/src/components/ui/badge';
import { CheckCircle2 } from 'lucide-react';
import type { LifeTask, TaskQuadrant } from '@shared/api.interface';

const QUADRANTS: {
  key: TaskQuadrant;
  label: string;
  desc: string;
  border: string;
  text: string;
}[] = [
  { key: 'q1', label: '重要 · 紧急', desc: '立即去做', border: 'border-red-500/40', text: 'text-red-400' },
  { key: 'q2', label: '重要 · 不紧急', desc: '计划去做', border: 'border-blue-500/40', text: 'text-blue-400' },
  { key: 'q3', label: '不重要 · 紧急', desc: '授权去做', border: 'border-amber-500/40', text: 'text-amber-400' },
  { key: 'q4', label: '不重要 · 不紧急', desc: '尽量不做', border: 'border-zinc-500/40', text: 'text-zinc-400' },
];

interface QuadrantMatrixProps {
  tasksByQuadrant: Record<TaskQuadrant, LifeTask[]>;
  onEdit: (task: LifeTask) => void;
  onToggleComplete: (task: LifeTask) => void;
}

const QuadrantMatrix = ({
  tasksByQuadrant,
  onEdit,
  onToggleComplete,
}: QuadrantMatrixProps) => {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-zinc-50 mb-4">四象限矩阵</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {QUADRANTS.map((q) => (
          <Card
            key={q.key}
            className={`bg-white/[0.03] backdrop-blur-xl border rounded-2xl transition-all duration-300 ease-out hover:shadow-2xl ${q.border}`}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className={`text-sm font-semibold ${q.text}`}>
                    {q.label}
                  </div>
                  <div className="text-xs text-zinc-500">{q.desc}</div>
                </div>
                <Badge
                  variant="outline"
                  className={`${q.text} border-current/30`}
                >
                  {tasksByQuadrant[q.key].length}
                </Badge>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {tasksByQuadrant[q.key].length === 0 ? (
                  <div className="text-xs text-zinc-600 py-4 text-center">
                    暂无任务
                  </div>
                ) : (
                  tasksByQuadrant[q.key].slice(0, 5).map((task) => (
                    <div
                      key={task.id}
                      onClick={() => onEdit(task)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] cursor-pointer transition-colors group"
                    >
                      <CheckCircle2
                        className={`w-4 h-4 flex-shrink-0 ${
                          task.status === 'done'
                            ? 'text-emerald-400'
                            : 'text-zinc-600 group-hover:text-zinc-400'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleComplete(task);
                        }}
                      />
                      <span
                        className={`text-sm truncate flex-1 ${
                          task.status === 'done'
                            ? 'text-zinc-500 line-through'
                            : 'text-zinc-200'
                        }`}
                      >
                        {task.title}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default QuadrantMatrix;
