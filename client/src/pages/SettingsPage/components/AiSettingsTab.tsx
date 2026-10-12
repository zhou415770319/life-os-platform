import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Server,
  Plus,
  Loader2,
  Trash2,
  Pencil,
  PlugZap,
  RefreshCw,
  Cpu,
  Save,
  Power,
  PowerOff,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronRight,
  CheckSquare,
  Square,
  CheckCheck,
  KeyRound,
  Link2,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import { aiSettingsApi } from '@client/src/api';
import type {
  AiModelAssignments,
  AiProvidersView,
  AiUsageKey,
} from '@shared/api.interface';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Badge } from '@client/src/components/ui/badge';
import { Switch } from '@client/src/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@client/src/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';

const USAGES: { key: AiUsageKey; label: string; desc: string }[] = [
  { key: 'chat', label: '人生系统助手（普通）', desc: '日常聊天、快捷功能、插件数据操作' },
  { key: 'deep', label: '人生系统助手（深度模式）', desc: '深度分析：注入习惯/目标/任务等实时数据后做分析建议' },
  { key: 'agent', label: '系统助手（创建/修改插件）', desc: '辅助创建插件、修改插件功能的系统任务' },
  { key: 'plugin', label: '插件默认模型', desc: '插件云函数 ctx.llm 调用模型时使用的默认模型' },
];

/** 选择框 + 手动输入模型 ID 的复合控件 */
const ModelKeySelect = ({
  value,
  options,
  onChange,
  placeholder,
  disabled,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) => {
  const isCustom = value && !options.some((o) => o.value === value);
  const selectValue = isCustom ? '__custom__' : value || '__none__';
  return (
    <div className="flex gap-2">
      <Select value={selectValue} onValueChange={(v) => onChange(v === '__none__' ? '' : v === '__custom__' ? value : v)} disabled={disabled}>
        <SelectTrigger className="bg-white/[0.03] border-white/10 text-zinc-200">
          <SelectValue placeholder={placeholder ?? '未设置（自动使用第一个可用模型）'} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">未设置（自动选择）</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
          {isCustom && <SelectItem value="__custom__">{value}（自定义）</SelectItem>}
        </SelectContent>
      </Select>
      {isCustom && (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="providerId:modelId"
          className="bg-white/[0.03] border-white/10 text-zinc-200 w-48"
        />
      )}
    </div>
  );
};

interface ProviderFormState {
  id?: string;
  name: string;
  baseUrl: string;
  apiKey: string;
}

const AiSettingsTab = () => {
  const [view, setView] = useState<AiProvidersView | null>(null);
  const [loading, setLoading] = useState(true);

  // 平台弹框
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ProviderFormState>({ name: '', baseUrl: '', apiKey: '' });
  const [formSaving, setFormSaving] = useState(false);

  // 平台测试 / 拉取模型
  const [testingId, setTestingId] = useState<string | null>(null);
  const [fetchingId, setFetchingId] = useState<string | null>(null);

  // 分配
  const [assignments, setAssignments] = useState<AiModelAssignments>({});
  const [assignSaving, setAssignSaving] = useState(false);

  // 手动添加模型
  const [addModelOpen, setAddModelOpen] = useState(false);
  const [addModelProviderId, setAddModelProviderId] = useState('');
  const [newModelId, setNewModelId] = useState('');
  const [newModelName, setNewModelName] = useState('');

  // 平台折叠（默认展开）
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  // 模型多选（providerId -> Set<modelId>）
  const [selectedModels, setSelectedModels] = useState<Record<string, Set<string>>>({});
  // 批量开启中
  const [bulkEnablingId, setBulkEnablingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await aiSettingsApi.getProviders();
      setView(data);
      setAssignments(data.assignments ?? {});
    } catch (err) {
      logger.error('Load AI providers failed', { error: String(err) });
      toast.error('加载 AI 配置失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const modelOptions = useMemo(
    () =>
      (view?.modelOptions ?? []).map((o) => ({
        value: o.value,
        label: `${o.label}${o.providerName ? `（${o.providerName}）` : ''}`,
      })),
    [view],
  );

  const enabledCount = useMemo(
    () => view?.providers.filter((p) => p.enabled).length ?? 0,
    [view],
  );

  // ===== 平台增删改 =====

  const openCreate = () => {
    setForm({ name: '', baseUrl: '', apiKey: '' });
    setFormOpen(true);
  };

  const openEdit = (p: { id: string; name: string; baseUrl: string }) => {
    setForm({ id: p.id, name: p.name, baseUrl: p.baseUrl, apiKey: '' });
    setFormOpen(true);
  };

  const handleSaveProvider = async () => {
    if (!form.name.trim() || !form.baseUrl.trim()) {
      toast.error('请填写平台名称与 Base URL');
      return;
    }
    setFormSaving(true);
    try {
      await aiSettingsApi.saveProvider({
        id: form.id,
        name: form.name.trim(),
        baseUrl: form.baseUrl.trim(),
        apiKey: form.apiKey || undefined,
        enabled: true,
      });
      toast.success(form.id ? '平台已更新' : '平台已添加');
      setFormOpen(false);
      await load();
    } catch (err) {
      logger.error('Save provider failed', { error: String(err) });
      toast.error('保存失败');
    } finally {
      setFormSaving(false);
    }
  };

  const handleToggleProvider = async (id: string, enabled: boolean) => {
    const p = view?.providers.find((x) => x.id === id);
    if (!p) return;
    try {
      await aiSettingsApi.saveProvider({ id, name: p.name, baseUrl: p.baseUrl, enabled });
      toast.success(enabled ? '平台已启用' : '平台已停用');
      await load();
    } catch (err) {
      logger.error('Toggle provider failed', { error: String(err) });
      toast.error('操作失败');
    }
  };

  const handleDeleteProvider = async (id: string) => {
    try {
      await aiSettingsApi.deleteProvider(id);
      toast.success('平台已删除');
      await load();
    } catch (err) {
      logger.error('Delete provider failed', { error: String(err) });
      toast.error('删除失败');
    }
  };

  const handleTestProvider = async (id: string, modelId?: string) => {
    setTestingId(id);
    try {
      const res = await aiSettingsApi.testProvider(id, modelId);
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
    } catch (err) {
      logger.error('Test provider failed', { error: String(err) });
      toast.error('测试失败');
    } finally {
      setTestingId(null);
    }
  };

  const handleFetchModels = async (id: string) => {
    setFetchingId(id);
    try {
      const res = await aiSettingsApi.fetchModels(id);
      if (res.ok) {
        toast.success(`已获取模型列表（新增 ${res.added?.length ?? 0} 个，共 ${res.total ?? 0} 个）`);
      } else {
        toast.error(res.message ?? '获取失败');
      }
      await load();
    } catch (err) {
      logger.error('Fetch models failed', { error: String(err) });
      toast.error('获取模型列表失败');
    } finally {
      setFetchingId(null);
    }
  };

  // ===== 模型启停 / 删除 =====

  const handleToggleModel = async (providerId: string, modelId: string, enabled: boolean) => {
    try {
      const res = await aiSettingsApi.updateModel(providerId, modelId, { enabled });
      if (!res.ok) toast.error(res.message ?? '操作失败');
      else await load();
    } catch (err) {
      logger.error('Toggle model failed', { error: String(err) });
      toast.error('操作失败');
    }
  };

  const handleDeleteModel = async (providerId: string, modelId: string) => {
    try {
      await aiSettingsApi.removeModel(providerId, modelId);
      toast.success('模型已删除');
      await load();
    } catch (err) {
      logger.error('Delete model failed', { error: String(err) });
      toast.error('删除失败');
    }
  };

  // ===== 模型多选 / 批量开启 =====

  const toggleModelSelected = (providerId: string, modelId: string) => {
    setSelectedModels((prev) => {
      const next = new Map(Object.entries(prev));
      const set = new Set(next.get(providerId) ?? []);
      if (set.has(modelId)) set.delete(modelId);
      else set.add(modelId);
      if (set.size === 0) next.delete(providerId);
      else next.set(providerId, set);
      return Object.fromEntries(next);
    });
  };

  const selectAllModels = (providerId: string) => {
    const p = view?.providers.find((x) => x.id === providerId);
    if (!p) return;
    setSelectedModels((prev) => {
      const next = new Map(Object.entries(prev));
      next.set(providerId, new Set(p.models.map((m) => m.id)));
      return Object.fromEntries(next);
    });
  };

  const clearSelectedModels = (providerId: string) => {
    setSelectedModels((prev) => {
      const next = new Map(Object.entries(prev));
      next.delete(providerId);
      return Object.fromEntries(next);
    });
  };

  const selectedCountOf = (providerId: string): number =>
    selectedModels[providerId]?.size ?? 0;

  /** 选中项是否全部处于开启状态（全部开启 → 按钮变为「关闭选中」） */
  const allSelectedEnabled = (providerId: string): boolean => {
    const p = view?.providers.find((x) => x.id === providerId);
    const ids = selectedModels[providerId] ?? new Set<string>();
    if (!p || ids.size === 0) return false;
    return p.models.filter((m) => ids.has(m.id)).every((m) => m.enabled);
  };

  const handleBulkEnable = async (providerId: string) => {
    const ids = Array.from(selectedModels[providerId] ?? []);
    if (ids.length === 0) {
      toast.error('请先勾选要操作的模型');
      return;
    }
    const enable = !allSelectedEnabled(providerId); // 全部开启 → 关闭；否则 → 开启
    setBulkEnablingId(providerId);
    let okCount = 0;
    try {
      for (const modelId of ids) {
        const res = await aiSettingsApi.updateModel(providerId, modelId, {
          enabled: enable,
        });
        if (res.ok) okCount += 1;
      }
      toast.success(`${enable ? '已开启' : '已关闭'} ${okCount}/${ids.length} 个模型`);
      setSelectedModels((prev) => {
        const next = new Map(Object.entries(prev));
        next.delete(providerId);
        return Object.fromEntries(next);
      });
      await load();
    } catch (err) {
      logger.error('Bulk update models failed', { error: String(err) });
      toast.error('批量操作失败');
    } finally {
      setBulkEnablingId(null);
    }
  };

  // ===== 手动添加模型 =====

  const openAddModel = (providerId: string) => {
    setAddModelProviderId(providerId);
    setNewModelId('');
    setNewModelName('');
    setAddModelOpen(true);
  };

  const handleAddModel = async () => {
    if (!newModelId.trim()) {
      toast.error('请填写模型 ID');
      return;
    }
    try {
      const res = await aiSettingsApi.addModel(addModelProviderId, {
        id: newModelId.trim(),
        name: newModelName.trim() || undefined,
      });
      if (!res.ok) toast.error(res.message ?? '添加失败');
      else {
        toast.success('模型已添加');
        setAddModelOpen(false);
        await load();
      }
    } catch (err) {
      logger.error('Add model failed', { error: String(err) });
      toast.error('添加失败');
    }
  };

  // ===== 默认模型分配 =====

  const handleSaveAssignments = async () => {
    setAssignSaving(true);
    try {
      const res = await aiSettingsApi.saveAssignments(assignments);
      if (!res.ok) {
        toast.error(res.message ?? '保存失败');
      } else {
        toast.success('默认模型分配已保存');
        setAssignments(res.data ?? assignments);
      }
    } catch (err) {
      logger.error('Save assignments failed', { error: String(err) });
      toast.error('保存失败');
    } finally {
      setAssignSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10">
        <CardContent className="flex items-center justify-center py-12 text-zinc-500 text-sm gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          加载 AI 配置...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 概览 */}
      <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-50 flex items-center gap-2">
            <Server className="w-4 h-4 text-indigo-400" />
            AI 模型服务（多平台）
          </CardTitle>
          <CardDescription className="text-zinc-400">
            仿 Cherry Studio：可添加多个模型平台（OpenAI 兼容协议），获取平台模型列表，并按用途配置默认模型。未配置任何平台时自动回退到下方旧版单配置。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30">
            平台 {view?.providers.length ?? 0} 个 · 启用 {enabledCount} 个
          </Badge>
          {view?.legacy.configured && (
            <Badge variant="outline" className="bg-amber-500/20 text-amber-300 border-amber-500/30">
              <Info className="w-3 h-3 mr-1" />
              旧版单配置可用（回退）：{view.legacy.baseUrl} / {view.legacy.model}
            </Badge>
          )}
          {enabledCount === 0 && !view?.legacy.configured && (
            <Badge variant="outline" className="bg-rose-500/20 text-rose-300 border-rose-500/30">
              <AlertTriangle className="w-3 h-3 mr-1" />
              未配置可用模型，AI 助手不可用
            </Badge>
          )}
          <div className="ml-auto">
            <Button
              onClick={openCreate}
              className="bg-gradient-to-r from-indigo-500 to-purple-600 border-0 text-white hover:opacity-90"
            >
              <Plus className="w-4 h-4" />
              添加模型服务
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 平台列表 */}
      <div className="space-y-3">
        {view && view.providers.length === 0 && (
          <Card className="bg-white/[0.03] border border-white/10">
            <CardContent className="py-10 text-center text-zinc-500 text-sm">
              还没有模型服务平台。点击「添加模型服务」，填入平台的 Base URL 与 API Key（如 DeepSeek / 硅基流动 / OpenAI 等 OpenAI 兼容平台）。
            </CardContent>
          </Card>
        )}

        {view?.providers.map((p) => (
          <Card key={p.id} className="bg-white/[0.03] border border-white/10">
            <CardContent className="p-4 space-y-4">
              {/* 平台头 */}
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-zinc-400 hover:text-white hover:bg-white/5"
                  onClick={() =>
                    setCollapsed((prev) => ({ ...prev, [p.id]: !prev[p.id] }))
                  }
                  title={collapsed[p.id] ? '展开模型列表' : '折叠模型列表'}
                >
                  {collapsed[p.id] ? (
                    <ChevronRight className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </Button>
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    p.enabled
                      ? 'bg-indigo-500/20 text-indigo-300'
                      : 'bg-zinc-500/15 text-zinc-500'
                  }`}
                >
                  <Server className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-100 font-medium">{p.name}</span>
                    {p.enabled ? (
                      <Badge variant="outline" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                        <Power className="w-3 h-3 mr-1" />
                        已启用
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-zinc-500/20 text-zinc-400 border-zinc-500/30">
                        <PowerOff className="w-3 h-3 mr-1" />
                        已停用
                      </Badge>
                    )}
                    <Badge variant="outline" className="bg-zinc-500/15 text-zinc-400 border-zinc-500/20">
                      <Cpu className="w-3 h-3 mr-1" />
                      {p.models.filter((m) => m.enabled).length}/{p.models.length} 模型启用
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 mt-1">
                    <span className="flex items-center gap-1 truncate max-w-[320px]">
                      <Link2 className="w-3 h-3 shrink-0" />
                      {p.baseUrl}
                    </span>
                    {p.configured ? (
                      <span className="flex items-center gap-1">
                        <KeyRound className="w-3 h-3" />
                        {p.apiKeyMasked}
                      </span>
                    ) : (
                      <span className="text-amber-400/80">未配置 API Key</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-white/10 text-zinc-300 hover:text-white"
                    disabled={testingId === p.id}
                    onClick={() => handleTestProvider(p.id)}
                  >
                    {testingId === p.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <PlugZap className="w-3.5 h-3.5" />
                    )}
                    测试
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-white/10 text-zinc-300 hover:text-white"
                    disabled={fetchingId === p.id}
                    onClick={() => handleFetchModels(p.id)}
                    title="从平台拉取模型列表并合并"
                  >
                    {fetchingId === p.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    获取模型
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-white/10 text-zinc-300 hover:text-white"
                    onClick={() => openEdit(p)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-white/10 text-zinc-300 hover:text-rose-300"
                    onClick={() => handleDeleteProvider(p.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                  <Switch
                    checked={p.enabled}
                    onCheckedChange={(v) => handleToggleProvider(p.id, v)}
                  />
                </div>
              </div>

              {/* 模型列表 */}
              <div className="pl-12">
                {!collapsed[p.id] && (
                  <>
                    {p.models.length === 0 ? (
                      <p className="text-xs text-zinc-600">
                        暂无模型。点击「获取模型」自动拉取平台模型列表，或手动添加。
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {/* 批量操作行 */}
                        <div className="flex flex-wrap items-center gap-2 pb-1">
                          <span className="text-xs text-zinc-500">
                            已勾选 {selectedCountOf(p.id)} 个
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-zinc-400 hover:text-white"
                            onClick={() => selectAllModels(p.id)}
                          >
                            <CheckSquare className="w-3.5 h-3.5 mr-1" />
                            全选
                          </Button>
                          {selectedCountOf(p.id) > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs text-zinc-400 hover:text-white"
                              onClick={() => clearSelectedModels(p.id)}
                            >
                              <Square className="w-3.5 h-3.5 mr-1" />
                              清空
                            </Button>
                          )}
                          <Button
                            size="sm"
                            disabled={bulkEnablingId === p.id || selectedCountOf(p.id) === 0}
                            onClick={() => handleBulkEnable(p.id)}
                            className={`h-6 px-2.5 text-xs border-0 text-white hover:opacity-90 ${
                              allSelectedEnabled(p.id)
                                ? 'bg-gradient-to-r from-rose-500 to-orange-500'
                                : 'bg-gradient-to-r from-emerald-500 to-teal-600'
                            }`}
                            title={
                              allSelectedEnabled(p.id)
                                ? '选中项全部处于开启状态，点击将全部关闭'
                                : '选中项包含关闭状态的模型，点击将全部开启'
                            }
                          >
                            {bulkEnablingId === p.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                            ) : allSelectedEnabled(p.id) ? (
                              <PowerOff className="w-3.5 h-3.5 mr-1" />
                            ) : (
                              <CheckCheck className="w-3.5 h-3.5 mr-1" />
                            )}
                            {allSelectedEnabled(p.id) ? '关闭选中' : '开启选中'}
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {p.models.map((m) => {
                            const selected = selectedModels[p.id]?.has(m.id) ?? false;
                            return (
                              <div
                                key={m.id}
                                className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer select-none ${
                                  selected
                                    ? 'bg-emerald-500/[0.08] border-emerald-500/30'
                                    : m.enabled
                                      ? 'bg-indigo-500/[0.06] border-indigo-500/20'
                                      : 'bg-zinc-500/[0.05] border-white/5 opacity-60'
                                }`}
                                onClick={() => toggleModelSelected(p.id, m.id)}
                                title={selected ? '取消勾选' : '勾选（可批量开启）'}
                              >
                                {selected ? (
                                  <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                                ) : (
                                  <Square className="w-4 h-4 text-zinc-500 shrink-0" />
                                )}
                                <Cpu className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm text-zinc-200 truncate">{m.name || m.id}</div>
                                  <div className="text-xs text-zinc-600 truncate">{m.id}</div>
                                </div>
                                {m.contextLength ? (
                                  <span className="text-[11px] text-zinc-600 whitespace-nowrap">
                                    {m.contextLength >= 1000 ? `${(m.contextLength / 1000).toFixed(0)}k` : m.contextLength}
                                  </span>
                                ) : null}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-zinc-500 hover:text-rose-300"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteModel(p.id, m.id);
                                  }}
                                  title="删除模型"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                                <Switch
                                  checked={m.enabled}
                                  onCheckedChange={(v) => handleToggleModel(p.id, m.id, v)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 border-white/10 text-zinc-400 hover:text-white"
                      onClick={() => openAddModel(p.id)}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      手动添加模型
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 默认模型分配 */}
      <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10">
        <CardHeader>
          <CardTitle className="text-base text-zinc-50 flex items-center gap-2">
            <Save className="w-4 h-4 text-emerald-400" />
            默认模型分配（按用途）
          </CardTitle>
          <CardDescription className="text-zinc-400">
            各场景调用大模型时使用的默认模型。未设置时自动选择第一个启用平台的第一个启用模型；也可手动填写「providerId:modelId」。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {USAGES.map((u) => (
            <div key={u.key} className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-2 items-start">
              <div>
                <div className="text-sm text-zinc-200">{u.label}</div>
                <div className="text-xs text-zinc-600">{u.desc}</div>
              </div>
              <ModelKeySelect
                value={assignments[u.key] ?? ''}
                options={modelOptions}
                onChange={(v) => setAssignments((prev) => ({ ...prev, [u.key]: v }))}
              />
            </div>
          ))}
          <div className="flex justify-end">
            <Button
              onClick={handleSaveAssignments}
              disabled={assignSaving}
              className="bg-gradient-to-r from-emerald-500 to-teal-600 border-0 text-white hover:opacity-90"
            >
              {assignSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              保存默认模型分配
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 旧版单配置（兼容回退说明） */}
      {view?.legacy.configured && (
        <Card className="bg-white/[0.03] border border-amber-500/15">
          <CardContent className="p-4 flex flex-wrap items-center gap-2 text-sm text-zinc-400">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="flex-1 min-w-[240px]">
              检测到旧版单配置（{view.legacy.baseUrl} / {view.legacy.model}），在未配置模型服务平台时仍会生效。
              建议将其迁移为上方模型服务平台，以获得按用途分配默认模型的能力。
            </span>
          </CardContent>
        </Card>
      )}

      {/* 新增/编辑平台弹框 */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="bg-zinc-950 border-white/10 text-zinc-100 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Server className="w-4 h-4 text-indigo-400" />
              {form.id ? '编辑模型服务' : '添加模型服务'}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              支持任意 OpenAI 兼容协议平台（DeepSeek / 硅基流动 / OpenAI / Moonshot / 通义千问等）。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm text-zinc-300">平台名称</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="如：DeepSeek / 硅基流动"
                className="bg-white/[0.03] border-white/10 text-zinc-200"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-zinc-300">Base URL</label>
              <Input
                value={form.baseUrl}
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                placeholder="https://api.deepseek.com/v1 或 https://api.siliconflow.cn/v1"
                className="bg-white/[0.03] border-white/10 text-zinc-200"
              />
              <p className="text-xs text-zinc-600">
                填平台根地址即可（如 https://api.deepseek.com/v1），系统会自动拼接 /chat/completions 与 /models
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-zinc-300">API Key</label>
              <Input
                type="password"
                value={form.apiKey}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                placeholder={form.id ? '留空表示不修改' : 'sk-...'}
                className="bg-white/[0.03] border-white/10 text-zinc-200"
                autoComplete="off"
              />
              <p className="text-xs text-zinc-600">仅保存在本地 user-data/ai-providers.json，不会上传到任何服务器</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-white/10 text-zinc-300"
              onClick={() => setFormOpen(false)}
            >
              取消
            </Button>
            <Button
              onClick={handleSaveProvider}
              disabled={formSaving}
              className="bg-gradient-to-r from-indigo-500 to-purple-600 border-0 text-white hover:opacity-90"
            >
              {formSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 手动添加模型弹框 */}
      <Dialog open={addModelOpen} onOpenChange={setAddModelOpen}>
        <DialogContent className="bg-zinc-950 border-white/10 text-zinc-100 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-400" />
              手动添加模型
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              平台拉取不到、或想添加自定义模型时，可手动登记模型 ID。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm text-zinc-300">模型 ID</label>
              <Input
                value={newModelId}
                onChange={(e) => setNewModelId(e.target.value)}
                placeholder="如：deepseek-chat / Qwen/Qwen3-8B"
                className="bg-white/[0.03] border-white/10 text-zinc-200"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-zinc-300">展示名（可选）</label>
              <Input
                value={newModelName}
                onChange={(e) => setNewModelName(e.target.value)}
                placeholder="留空则同模型 ID"
                className="bg-white/[0.03] border-white/10 text-zinc-200"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-white/10 text-zinc-300"
              onClick={() => setAddModelOpen(false)}
            >
              取消
            </Button>
            <Button
              onClick={handleAddModel}
              className="bg-gradient-to-r from-indigo-500 to-purple-600 border-0 text-white hover:opacity-90"
            >
              <Plus className="w-4 h-4" />
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AiSettingsTab;
