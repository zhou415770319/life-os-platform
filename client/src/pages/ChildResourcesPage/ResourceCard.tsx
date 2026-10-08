import {
  BookOpen,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  BookText,
  Calculator,
  FlaskConical,
  Star,
  Video,
  Headphones,
  Package,
  Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@client/src/components/ui/card';
import { Badge } from '@client/src/components/ui/badge';
import { Button } from '@client/src/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@client/src/components/ui/dropdown-menu';
import type { ChildResource } from '@shared/api.interface';

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

const CATEGORY_GRADIENT: Record<string, string> = {
  english: 'from-indigo-500/20 to-purple-500/20 border-indigo-500/20 text-indigo-300',
  chinese: 'from-rose-500/20 to-pink-500/20 border-rose-500/20 text-rose-300',
  math: 'from-cyan-500/20 to-blue-500/20 border-cyan-500/20 text-cyan-300',
  science: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/20 text-emerald-300',
};

const BADGE_STYLE: Record<string, string> = {
  english: 'border-indigo-500/20 text-indigo-300 bg-indigo-500/10',
  chinese: 'border-rose-500/20 text-rose-300 bg-rose-500/10',
  math: 'border-cyan-500/20 text-cyan-300 bg-cyan-500/10',
  science: 'border-emerald-500/20 text-emerald-300 bg-emerald-500/10',
};

interface ResourceCardProps {
  resource: ChildResource;
  onView: (resource: ChildResource) => void;
  onEdit: (resource: ChildResource) => void;
  onDelete: (resource: ChildResource) => void;
}

export default function ResourceCard({
  resource,
  onView,
  onEdit,
  onDelete,
}: ResourceCardProps) {
  const IconComponent = ICON_MAP[resource.icon ?? ''] ?? BookOpen;
  const gradientClass =
    CATEGORY_GRADIENT[resource.category] ??
    'from-zinc-500/20 to-zinc-600/20 border-zinc-500/20 text-zinc-300';
  const badgeClass =
    BADGE_STYLE[resource.category] ??
    'border-zinc-500/20 text-zinc-300 bg-zinc-500/10';

  return (
    <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10 hover:border-white/20 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div
            className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradientClass} border flex items-center justify-center`}
          >
            <IconComponent className="w-5 h-5" />
          </div>
          <div className="flex items-center gap-2">
            {resource.level && (
              <Badge
                variant="outline"
                className={`text-xs ${badgeClass}`}
              >
                {resource.level}
              </Badge>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-zinc-400 hover:text-white"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="bg-zinc-900/95 border-white/10 text-zinc-200 backdrop-blur-xl"
              >
                <DropdownMenuItem onClick={() => onView(resource)}>
                  <Eye className="w-4 h-4" />
                  查看详情
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit(resource)}>
                  <Pencil className="w-4 h-4" />
                  编辑
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onDelete(resource)}
                  className="text-red-400 focus:text-red-300 focus:bg-red-500/10"
                >
                  <Trash2 className="w-4 h-4" />
                  删除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <h3 className="text-base font-semibold text-zinc-50 mb-2 truncate">
          {resource.name}
        </h3>
        <p className="text-sm text-zinc-400 mb-4 leading-relaxed line-clamp-2">
          {resource.description || '暂无描述'}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 border-white/10 text-zinc-300 hover:text-white hover:border-white/20 hover:bg-white/[0.05]"
            onClick={() => onView(resource)}
          >
            <Eye className="w-3.5 h-3.5" />
            查看详情
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
