import {
  BookOpen,
  ExternalLink,
  Pencil,
  BookText,
  Calculator,
  FlaskConical,
  Star,
  Video,
  Headphones,
  Package,
  Sparkles,
  CalendarDays,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@client/src/components/ui/dialog';
import { Button } from '@client/src/components/ui/button';
import { Badge } from '@client/src/components/ui/badge';
import type { ChildResource } from '@shared/api.interface';
import { showConfirm } from '@lark-apaas/client-toolkit';

const ICON_MAP: Record<string, LucideIcon> = {
  'book-open': BookOpen,
  'book-text': BookText,
  calculator: Calculator,
  'flask-conical': FlaskConical,
  star: Star,
  video: Video,
  headphones: Headphones,
  package: Package,
  sparkles: Sparkles,
};

const CATEGORY_LABELS: Record<string, string> = {
  english: '英语启蒙',
  chinese: '中文绘本',
  math: '数学思维',
  science: '科学探索',
  other: '其他',
};

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  book: '书籍',
  video: '视频',
  kit: '教具/套装',
  audio: '音频',
  other: '其他',
};

const CATEGORY_GRADIENT: Record<string, string> = {
  english: 'from-indigo-500/20 to-purple-500/20 border-indigo-500/20 text-indigo-300',
  chinese: 'from-rose-500/20 to-pink-500/20 border-rose-500/20 text-rose-300',
  math: 'from-cyan-500/20 to-blue-500/20 border-cyan-500/20 text-cyan-300',
  science: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/20 text-emerald-300',
};

interface ResourceDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resource: ChildResource | null;
  onEdit: (resource: ChildResource) => void;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function ResourceDetailDialog({
  open,
  onOpenChange,
  resource,
  onEdit,
}: ResourceDetailDialogProps) {
  const handleVisit = async () => {
    if (!resource?.resourceUrl) {
      toast.warning('该资源暂无链接');
      return;
    }
    if (!/^https?:\/\//i.test(resource.resourceUrl)) {
      toast.error('链接协议不安全，无法跳转');
      return;
    }
    const confirmed = await showConfirm(`即将在新窗口打开:\n${resource.resourceUrl}\n\n确认访问？`);
    if (confirmed) {
      window.open(resource.resourceUrl, '_blank', 'noopener,noreferrer');
    }
  };

  if (!resource) return null;

  const IconComponent = ICON_MAP[resource.icon ?? ''] ?? BookOpen;
  const gradientClass =
    CATEGORY_GRADIENT[resource.category] ??
    'from-zinc-500/20 to-zinc-600/20 border-zinc-500/20 text-zinc-300';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900/95 border-white/10 text-zinc-200 backdrop-blur-xl max-w-lg">
        <DialogHeader>
          <div className="flex items-start gap-4">
            <div
              className={`w-14 h-14 rounded-xl bg-gradient-to-br ${gradientClass} border flex items-center justify-center flex-shrink-0`}
            >
              <IconComponent className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-zinc-50 text-xl">
                {resource.name}
              </DialogTitle>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge
                  variant="outline"
                  className="border-white/10 text-zinc-300 bg-white/5"
                >
                  {CATEGORY_LABELS[resource.category] || resource.category}
                </Badge>
                <Badge
                  variant="outline"
                  className="border-white/10 text-zinc-300 bg-white/5"
                >
                  {RESOURCE_TYPE_LABELS[resource.resourceType] ||
                    resource.resourceType}
                </Badge>
                {resource.level && (
                  <Badge
                    variant="outline"
                    className="border-white/10 text-zinc-300 bg-white/5"
                  >
                    {resource.level}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {resource.series && (
            <div className="flex gap-3">
              <span className="text-sm text-zinc-500 w-20 flex-shrink-0">
                系列/分阶
              </span>
              <span className="text-sm text-zinc-200">{resource.series}</span>
            </div>
          )}

          <div className="flex gap-3">
            <span className="text-sm text-zinc-500 w-20 flex-shrink-0">
              描述
            </span>
            <p className="text-sm text-zinc-300 leading-relaxed flex-1">
              {resource.description || '暂无描述'}
            </p>
          </div>

          {resource.resourceUrl && (
            <div className="flex gap-3">
              <span className="text-sm text-zinc-500 w-20 flex-shrink-0">
                资源链接
              </span>
              <span className="text-sm text-indigo-400 break-all flex-1 truncate">
                {resource.resourceUrl}
              </span>
            </div>
          )}

          <div className="flex gap-3">
            <span className="text-sm text-zinc-500 w-20 flex-shrink-0 flex items-center gap-1">
              <CalendarDays className="w-3.5 h-3.5" />
              添加时间
            </span>
            <span className="text-sm text-zinc-400">
              {formatDate(resource.createdAt)}
            </span>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button
            variant="outline"
            onClick={() => onEdit(resource)}
            className="border-white/10 text-zinc-300 hover:text-white hover:border-white/20 hover:bg-white/[0.05]"
          >
            <Pencil className="w-4 h-4" />
            编辑
          </Button>
          <Button
            onClick={handleVisit}
            disabled={!resource.resourceUrl}
            className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-0 hover:opacity-90 disabled:opacity-50"
          >
            <ExternalLink className="w-4 h-4" />
            访问 / 下载
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
