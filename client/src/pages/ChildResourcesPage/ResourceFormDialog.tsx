import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@client/src/components/ui/dialog';
import { Input } from '@client/src/components/ui/input';
import { Button } from '@client/src/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { Textarea } from '@client/src/components/ui/textarea';
import {
  createChildResource,
  updateChildResource,
} from '@client/src/api/child-resources';
import type {
  ChildResource,
  CreateChildResourceDto,
  UpdateChildResourceDto,
} from '@shared/api.interface';

const CATEGORY_OPTIONS = [
  { value: 'english', label: '英语启蒙' },
  { value: 'chinese', label: '中文绘本' },
  { value: 'math', label: '数学思维' },
  { value: 'science', label: '科学探索' },
  { value: 'other', label: '其他' },
];

const RESOURCE_TYPE_OPTIONS = [
  { value: 'book', label: '书籍' },
  { value: 'video', label: '视频' },
  { value: 'kit', label: '教具/套装' },
  { value: 'audio', label: '音频' },
  { value: 'other', label: '其他' },
];

interface ResourceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editResource?: ChildResource | null;
}

const defaultForm: CreateChildResourceDto = {
  name: '',
  category: 'english',
  series: '',
  resourceType: 'book',
  description: '',
  resourceUrl: '',
  level: '',
  icon: 'book-open',
  sortOrder: 0,
};

export default function ResourceFormDialog({
  open,
  onOpenChange,
  editResource,
}: ResourceFormDialogProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CreateChildResourceDto>(defaultForm);
  const [customCategory, setCustomCategory] = useState('');
  const [categoryMode, setCategoryMode] = useState<'select' | 'custom'>(
    'select',
  );

  useEffect(() => {
    if (editResource) {
      const knownCategory = CATEGORY_OPTIONS.some(
        (opt) => opt.value === editResource.category,
      );
      setCategoryMode(knownCategory ? 'select' : 'custom');
      setForm({
        name: editResource.name,
        category: editResource.category,
        series: editResource.series ?? '',
        resourceType: editResource.resourceType,
        description: editResource.description ?? '',
        resourceUrl: editResource.resourceUrl ?? '',
        level: editResource.level ?? '',
        icon: editResource.icon ?? '',
        sortOrder: editResource.sortOrder,
      });
      setCustomCategory(knownCategory ? '' : editResource.category);
    } else {
      setForm(defaultForm);
      setCustomCategory('');
      setCategoryMode('select');
    }
  }, [editResource, open]);

  const isEdit = !!editResource;

  const createMutation = useMutation({
    mutationFn: (data: CreateChildResourceDto) => createChildResource(data),
    onSuccess: () => {
      toast.success('资源添加成功');
      queryClient.invalidateQueries({ queryKey: ['childResources'] });
      queryClient.invalidateQueries({ queryKey: ['childResourceCategories'] });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error('添加失败: ' + (err.message || '未知错误'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateChildResourceDto;
    }) => updateChildResource(id, data),
    onSuccess: () => {
      toast.success('资源更新成功');
      queryClient.invalidateQueries({ queryKey: ['childResources'] });
      queryClient.invalidateQueries({ queryKey: ['childResourceCategories'] });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error('更新失败: ' + (err.message || '未知错误'));
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('请输入资源名称');
      return;
    }
    if (form.resourceUrl && !/^https?:\/\//i.test(form.resourceUrl)) {
      toast.error('资源链接必须以 http:// 或 https:// 开头');
      return;
    }

    const finalCategory =
      categoryMode === 'custom' && customCategory.trim()
        ? customCategory.trim()
        : form.category;

    const payload: CreateChildResourceDto = {
      ...form,
      category: finalCategory,
    };

    if (isEdit && editResource) {
      updateMutation.mutate({ id: editResource.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900/95 border-white/10 text-zinc-200 backdrop-blur-xl max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-zinc-50">
            {isEdit ? '编辑资料' : '添加资料'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <label className="text-sm text-zinc-300">
              资源名称 <span className="text-red-400">*</span>
            </label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="请输入资源名称"
              className="border-white/10 text-zinc-100 placeholder:text-zinc-500 bg-white/[0.02]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-zinc-300">所属分类</label>
            {categoryMode === 'select' ? (
              <div className="flex gap-2">
                <Select
                  value={form.category}
                  onValueChange={(value) =>
                    setForm({ ...form, category: value })
                  }
                >
                  <SelectTrigger className="flex-1 border-white/10 text-zinc-100 bg-white/[0.02]">
                    <SelectValue placeholder="选择分类" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900/95 border-white/10 text-zinc-200 backdrop-blur-xl">
                    {CATEGORY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCategoryMode('custom')}
                  className="border-white/10 text-zinc-300 hover:text-white hover:border-white/20"
                >
                  自定义
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="自定义分类名"
                  className="flex-1 border-white/10 text-zinc-100 placeholder:text-zinc-500 bg-white/[0.02]"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCategoryMode('select');
                    setCustomCategory('');
                  }}
                  className="border-white/10 text-zinc-300 hover:text-white hover:border-white/20"
                >
                  选预设
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-zinc-300">系列/分阶</label>
              <Input
                value={form.series ?? ''}
                onChange={(e) =>
                  setForm({ ...form, series: e.target.value })
                }
                placeholder="如：RAZ aa级"
                className="border-white/10 text-zinc-100 placeholder:text-zinc-500 bg-white/[0.02]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-zinc-300">级别/年龄</label>
              <Input
                value={form.level ?? ''}
                onChange={(e) =>
                  setForm({ ...form, level: e.target.value })
                }
                placeholder="如：3-6岁"
                className="border-white/10 text-zinc-100 placeholder:text-zinc-500 bg-white/[0.02]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-zinc-300">资源类型</label>
              <Select
                value={form.resourceType}
                onValueChange={(value) =>
                  setForm({ ...form, resourceType: value })
                }
              >
                <SelectTrigger className="w-full border-white/10 text-zinc-100 bg-white/[0.02]">
                  <SelectValue placeholder="选择类型" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900/95 border-white/10 text-zinc-200 backdrop-blur-xl">
                  {RESOURCE_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-zinc-300">排序</label>
              <Input
                type="number"
                value={form.sortOrder ?? 0}
                onChange={(e) =>
                  setForm({ ...form, sortOrder: Number(e.target.value) })
                }
                className="border-white/10 text-zinc-100 bg-white/[0.02]"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-zinc-300">图标 (Lucide)</label>
            <Input
              value={form.icon ?? ''}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
              placeholder="如：book-open, star, video"
              className="border-white/10 text-zinc-100 placeholder:text-zinc-500 bg-white/[0.02]"
            />
            <p className="text-xs text-zinc-500">
              输入 Lucide 图标名（kebab-case），未知图标默认显示 BookOpen
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-zinc-300">描述</label>
            <Textarea
              value={form.description ?? ''}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="请输入资源描述"
              rows={3}
              className="border-white/10 text-zinc-100 placeholder:text-zinc-500 bg-white/[0.02]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-zinc-300">资源链接</label>
            <Input
              value={form.resourceUrl ?? ''}
              onChange={(e) =>
                setForm({ ...form, resourceUrl: e.target.value })
              }
              placeholder="https://example.com"
              className="border-white/10 text-zinc-100 placeholder:text-zinc-500 bg-white/[0.02]"
            />
            <p className="text-xs text-zinc-500">
              仅支持 http:// 或 https:// 协议
            </p>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-white/10 text-zinc-300 hover:text-white hover:border-white/20 hover:bg-white/[0.05]"
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-0 hover:opacity-90"
            >
              {isSubmitting ? '提交中...' : isEdit ? '保存修改' : '添加资源'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
