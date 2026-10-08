import { FileText, MessageSquare, Eye } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';
import { Badge } from '@client/src/components/ui/badge';

export interface HistoryTask {
  id: string;
  title: string;
  status: '草稿' | '已发布';
  createdAt: string;
}

export const initialHistory: HistoryTask[] = [
  {
    id: '1',
    title: 'AI 时代下的产品经理如何转型',
    status: '已发布',
    createdAt: '2026-09-08 14:30',
  },
  {
    id: '2',
    title: '一周读完 3 本书的高效阅读法',
    status: '草稿',
    createdAt: '2026-09-07 20:15',
  },
  {
    id: '3',
    title: '2026 年值得关注的 10 个 AI 工具',
    status: '已发布',
    createdAt: '2026-09-05 10:00',
  },
  {
    id: '4',
    title: '从程序员到自由职业者的三年复盘',
    status: '草稿',
    createdAt: '2026-09-02 16:45',
  },
  {
    id: '5',
    title: '极简主义生活方式实践指南',
    status: '已发布',
    createdAt: '2026-08-28 09:20',
  },
];

interface TaskHistoryListProps {
  history: HistoryTask[];
}

const TaskHistoryList: React.FC<TaskHistoryListProps> = ({ history }) => {
  return (
    <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10">
      <CardHeader>
        <CardTitle className="text-lg text-zinc-50 flex items-center gap-2">
          <FileText className="w-4 h-4 text-zinc-400" />
          历史任务
        </CardTitle>
        <CardDescription className="text-zinc-400">
          最近 5 次生成任务
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {history.map((task) => (
          <div
            key={task.id}
            className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <MessageSquare className="w-4 h-4 text-zinc-500 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm text-zinc-200 truncate">{task.title}</div>
                <div className="text-xs text-zinc-500">{task.createdAt}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge
                variant="outline"
                className={
                  task.status === '已发布'
                    ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                    : 'border-amber-500/30 text-amber-400 bg-amber-500/10'
                }
              >
                {task.status}
              </Badge>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 hover:text-zinc-200">
                <Eye className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default TaskHistoryList;
