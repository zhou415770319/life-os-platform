import { useState, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  BookText,
  Calculator,
  FlaskConical,
  Plus,
  Search,
  Trash2,
  BookMarked,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@client/src/components/ui/tabs';
import { Card, CardContent } from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@client/src/components/ui/dialog';
import BackgroundGlow from '@client/src/components/ui/background-glow';
import ResourceCard from './ResourceCard';
import ResourceFormDialog from './ResourceFormDialog';
import ResourceDetailDialog from './ResourceDetailDialog';
import {
  getChildResources,
  getChildResourceCategories,
  deleteChildResource,
} from '@client/src/api/child-resources';
import type { ChildResource } from '@shared/api.interface';

const CATEGORY_LABELS: Record<string, string> = {
  english: '英语启蒙',
  chinese: '中文绘本',
  math: '数学思维',
  science: '科学探索',
  other: '其他',
};

const CATEGORY_ICONS: Record<string, ReactNode | null> = {
  english: <BookOpen className="w-4 h-4" />,
  chinese: <BookText className="w-4 h-4" />,
  math: <Calculator className="w-4 h-4" />,
  science: <FlaskConical className="w-4 h-4" />,
  other: <BookMarked className="w-4 h-4" />,
};

const RESOURCE_TYPE_OPTIONS = [
  { value: '', label: '全部类型' },
  { value: 'book', label: '书籍' },
  { value: 'video', label: '视频' },
  { value: 'kit', label: '教具/套装' },
  { value: 'audio', label: '音频' },
  { value: 'other', label: '其他' },
];

const ChildResourcesPage = () => {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editResource, setEditResource] = useState<ChildResource | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailResource, setDetailResource] = useState<ChildResource | null>(
    null,
  );
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteResource, setDeleteResource] = useState<ChildResource | null>(
    null,
  );

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data: categoriesData, isLoading: categoriesLoading } = useQuery({
    queryKey: ['childResourceCategories'],
    queryFn: () => getChildResourceCategories(),
  });

  const tabList = useMemo(() => {
    const serverCategories = categoriesData?.items ?? [];
    const presetKnown = ['english', 'chinese', 'math', 'science'];
    const knownPreset = presetKnown.filter((k) =>
      serverCategories.length > 0 ? serverCategories.includes(k) : true,
    );
    const customCats = serverCategories.filter(
      (c) => !presetKnown.includes(c) && c !== 'other',
    );
    const hasOther =
      serverCategories.includes('other') || serverCategories.length === 0;

    const result = [
      { key: 'all', label: '全部', icon: null },
    ];

    for (const key of knownPreset) {
      result.push({
        key,
        label: CATEGORY_LABELS[key] ?? key,
        icon: CATEGORY_ICONS[key] ?? null,
      });
    }
    for (const cat of customCats) {
      result.push({
        key: cat,
        label: CATEGORY_LABELS[cat] ?? cat,
        icon: CATEGORY_ICONS[cat] ?? <BookMarked className="w-4 h-4" />,
      });
    }
    if (hasOther || serverCategories.length === 0) {
      result.push({
        key: 'other',
        label: CATEGORY_LABELS.other,
        icon: CATEGORY_ICONS.other,
      });
    }

    return result;
  }, [categoriesData]);

  const { data, isLoading, error } = useQuery({
    queryKey: [
      'childResources',
      {
        category: activeTab === 'all' ? undefined : activeTab,
        search: searchQuery || undefined,
        resourceType: typeFilter || undefined,
      },
    ],
    queryFn: () =>
      getChildResources({
        category: activeTab === 'all' ? undefined : activeTab,
        search: searchQuery || undefined,
        resourceType: typeFilter || undefined,
        pageSize: 100,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteChildResource(id),
    onSuccess: () => {
      toast.success('删除成功');
      queryClient.invalidateQueries({ queryKey: ['childResources'] });
      queryClient.invalidateQueries({ queryKey: ['childResourceCategories'] });
      setDeleteOpen(false);
      setDeleteResource(null);
    },
    onError: (err: Error) => {
      toast.error('删除失败: ' + (err.message || '未知错误'));
    },
  });

  const handleView = (resource: ChildResource) => {
    setDetailResource(resource);
    setDetailOpen(true);
  };

  const handleCreate = () => {
    setEditResource(null);
    setFormOpen(true);
  };

  const handleEdit = (resource: ChildResource) => {
    setDetailOpen(false);
    setEditResource(resource);
    setFormOpen(true);
  };

  const handleDelete = (resource: ChildResource) => {
    setDeleteResource(resource);
    setDeleteOpen(true);
  };

  const confirmDelete = () => {
    if (deleteResource) {
      deleteMutation.mutate(deleteResource.id);
    }
  };

  const items = data?.items ?? [];
  const isEmpty = !isLoading && items.length === 0;

  return (
    <div className="min-h-full p-6 md:p-10">
      <BackgroundGlow variant="page" />

      {/* 顶部标题区 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
            儿童启蒙资料站
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            RAZ、廖彩杏、牛津树等优质教育资源导航
          </p>
        </div>
        <Button
          onClick={handleCreate}
          className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-0 hover:opacity-90"
        >
          <Plus className="w-4 h-4" />
          添加资料
        </Button>
      </div>

      {/* 搜索筛选栏 */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="搜索资源名称或描述..."
            className="pl-10 border-white/10 text-zinc-100 placeholder:text-zinc-500 bg-white/[0.02] h-10"
          />
        </div>
        <div className="flex gap-3">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40 border-white/10 text-zinc-100 bg-white/[0.02] h-10">
              <SelectValue placeholder="资源类型" />
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
      </div>

      {/* 分类 Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="mb-6"
      >
        <TabsList className="bg-white/[0.03] border border-white/5 p-1 flex-wrap h-auto">
          {tabList.map((tab) => (
            <TabsTrigger
              key={tab.key}
              value={tab.key}
              className="data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:border-white/10 text-zinc-400 gap-1.5"
            >
              {tab.icon}
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* 资源卡片网格 */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card
              key={i}
              className="bg-white/[0.03] backdrop-blur-xl border border-white/10 overflow-hidden animate-pulse"
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-white/10" />
                  <div className="w-16 h-6 rounded-md bg-white/10" />
                </div>
                <div className="h-5 bg-white/10 rounded mb-2 w-3/4" />
                <div className="h-4 bg-white/5 rounded mb-1 w-full" />
                <div className="h-4 bg-white/5 rounded mb-4 w-5/6" />
                <div className="h-8 bg-white/10 rounded w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-16">
          <p className="text-zinc-400 mb-4">加载失败，请稍后重试</p>
          <Button
            variant="outline"
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: ['childResources'] })
            }
            className="border-white/10 text-zinc-300 hover:text-white hover:border-white/20"
          >
            重新加载
          </Button>
        </div>
      ) : isEmpty ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center">
            <BookOpen className="w-7 h-7 text-zinc-500" />
          </div>
          <h3 className="text-base font-medium text-zinc-300 mb-1">
            暂无资源
          </h3>
          <p className="text-sm text-zinc-500 mb-4">
            点击右上角「添加资料」开始创建
          </p>
          <Button
            onClick={handleCreate}
            className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-0 hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            添加第一个资源
          </Button>
        </div>
      ) : (
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          data-ai-section-type="card-list"
        >
          {items.map((resource: ChildResource) => (
            <ResourceCard
              key={resource.id}
              resource={resource}
              onView={handleView}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* 总条数提示 */}
      {!isLoading && !isEmpty && data && (
        <div className="mt-6 text-center text-xs text-zinc-500">
          共 {data.total} 条资源
        </div>
      )}

      {/* 添加/编辑表单弹窗 */}
      <ResourceFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editResource={editResource}
      />

      {/* 详情弹窗 */}
      <ResourceDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        resource={detailResource}
        onEdit={handleEdit}
      />

      {/* 删除确认弹窗 */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="bg-zinc-900/95 border-white/10 text-zinc-200 backdrop-blur-xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-zinc-50">确认删除</DialogTitle>
            <DialogDescription className="text-zinc-400">
              确定要删除资源「{deleteResource?.name}」吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              className="border-white/10 text-zinc-300 hover:text-white hover:border-white/20 hover:bg-white/[0.05]"
            >
              取消
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-red-500 hover:bg-red-600 text-white border-0"
            >
              <Trash2 className="w-4 h-4" />
              {deleteMutation.isPending ? '删除中...' : '确认删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChildResourcesPage;
