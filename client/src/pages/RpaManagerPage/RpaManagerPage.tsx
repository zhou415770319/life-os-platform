import { useCallback, useEffect, useState } from 'react';
import {
  FolderOpen,
  FileUp,
  FileSpreadsheet,
  Download,
  Trash2,
  Loader2,
  Plus,
  Minus,
  Save,
  RefreshCw,
  Table2,
  HardDrive,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit/logger';
import {
  readSavedExcel,
  saveExcelFile,
  listRpaFiles,
  deleteRpaFile,
  downloadRpaFile,
  openRpaFolder,
  openRpaLibraryFolder,
  importRpaByPath,
  pickRpaFile,
  pickRpaFolder,
} from '@client/src/api/rpa-manager';
import type { ExcelCellValue, RpaFileInfo } from '@shared/api.interface';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';
import { Badge } from '@client/src/components/ui/badge';
import { Input } from '@client/src/components/ui/input';
import BackgroundGlow from '@client/src/components/ui/background-glow';
import { useConfirmDialog } from '@client/src/hooks/use-confirm-dialog';

interface SheetEditorState {
  sheets: { name: string; rows: ExcelCellValue[][] }[];
  activeSheet: number;
  originalName: string;
  /** 本地库登记的文件路径；保存时直接写回原文件 */
  path?: string;
  dirty: boolean;
}

const EXCEL_EXT = /\.(xlsx|xls)$/i;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return iso;
  }
}

const RpaManagerPage = () => {
  const [savedFiles, setSavedFiles] = useState<RpaFileInfo[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [reading, setReading] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [openingFolder, setOpeningFolder] = useState<string | null>(null);
  const [openingLibrary, setOpeningLibrary] = useState(false);
  const [importPath, setImportPath] = useState('');
  const [importing, setImporting] = useState(false);
  const [picking, setPicking] = useState<null | 'file' | 'folder'>(null);
  const [editor, setEditor] = useState<SheetEditorState | null>(null);
  const { openConfirm, ConfirmDialog } = useConfirmDialog();

  const refreshSaved = useCallback(async () => {
    setLoadingFiles(true);
    try {
      const res = await listRpaFiles();
      setSavedFiles(res.items);
    } catch (err) {
      logger.error('List rpa files failed', String(err));
      toast.error('加载本地文件库失败');
    } finally {
      setLoadingFiles(false);
    }
  }, []);

  useEffect(() => {
    refreshSaved();
  }, [refreshSaved]);

  /** 系统对话框选择单个 Excel 文件 → 登记 → 直接进入编辑 */
  const handlePickFile = async () => {
    setPicking('file');
    try {
      const res = await pickRpaFile();
      if (!res.picked || !res.path) return; // 用户取消
      const imp = await importRpaByPath(res.path);
      if (imp.single) {
        setEditor({
          sheets: imp.single.sheets.map((s) => ({ name: s.name, rows: s.rows })),
          activeSheet: 0,
          originalName: imp.single.fileName.replace(EXCEL_EXT, ''),
          path: imp.items[0]?.path,
          dirty: false,
        });
        toast.success(`已登记并读取「${imp.single.fileName}」，保存将直接写回原文件`);
      } else {
        toast.warning('该路径下未找到 Excel 文件');
      }
      await refreshSaved();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || '选择文件失败');
    } finally {
      setPicking(null);
    }
  };

  /** 系统对话框选择文件夹 → 扫描登记其中所有 Excel */
  const handlePickFolder = async () => {
    setPicking('folder');
    try {
      const res = await pickRpaFolder();
      if (!res.picked || !res.path) return; // 用户取消
      const imp = await importRpaByPath(res.path);
      if (imp.imported > 0) {
        toast.success(`已登记 ${imp.imported} 个 Excel 文件到本地库`);
      } else {
        toast.warning('该文件夹下没有 Excel 文件');
      }
      await refreshSaved();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || '选择文件夹失败');
    } finally {
      setPicking(null);
    }
  };

  /** 按路径登记导入：文件直接进入编辑，文件夹登记后刷新列表 */
  const handleImportByPath = async () => {
    const p = importPath.trim();
    if (!p) {
      toast.warning('请输入文件或文件夹的绝对路径');
      return;
    }
    setImporting(true);
    try {
      const res = await importRpaByPath(p);
      if (res.single) {
        setEditor({
          sheets: res.single.sheets.map((s) => ({ name: s.name, rows: s.rows })),
          activeSheet: 0,
          originalName: res.single.fileName.replace(EXCEL_EXT, ''),
          path: res.items[0]?.path,
          dirty: false,
        });
        toast.success(`已登记并读取「${res.single.fileName}」，保存将直接写回原文件`);
      } else {
        toast.success(`已登记 ${res.imported} 个 Excel 文件到本地库`);
      }
      await refreshSaved();
      setImportPath('');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || '导入失败');
    } finally {
      setImporting(false);
    }
  };

  /** 读取本地库已登记的文件 */
  const handleReadSaved = async (file: RpaFileInfo) => {
    setReading(file.fileName);
    try {
      const data = await readSavedExcel(file.path);
      setEditor({
        sheets: data.sheets.map((s) => ({ name: s.name, rows: s.rows })),
        activeSheet: 0,
        originalName: data.fileName.replace(EXCEL_EXT, ''),
        path: file.path,
        dirty: false,
      });
      toast.success(`已读取「${file.fileName}」`);
    } catch (err: any) {
      const msg = err?.response?.data?.message || '读取失败';
      logger.error('Read saved excel failed', String(err));
      toast.error(msg);
    } finally {
      setReading(null);
    }
  };

  /** 单元格编辑 */
  const updateCell = (sheetIdx: number, rowIdx: number, colIdx: number, value: ExcelCellValue) => {
    setEditor((prev) => {
      if (!prev) return prev;
      const sheets = prev.sheets.map((s, si) =>
        si === sheetIdx
          ? {
              ...s,
              rows: s.rows.map((row, r) =>
                r === rowIdx ? row.map((cell, c) => (c === colIdx ? value : cell)) : row,
              ),
            }
          : s,
      );
      return { ...prev, sheets, dirty: true };
    });
  };

  /** 追加一行 */
  const addRow = (sheetIdx: number) => {
    setEditor((prev) => {
      if (!prev) return prev;
      const sheets = prev.sheets.map((s, si) =>
        si === sheetIdx ? { ...s, rows: [...s.rows, []] } : s,
      );
      return { ...prev, sheets, dirty: true };
    });
  };

  /** 删除一行 */
  const removeRow = (sheetIdx: number, rowIdx: number) => {
    setEditor((prev) => {
      if (!prev) return prev;
      const sheets = prev.sheets.map((s, si) =>
        si === sheetIdx ? { ...s, rows: s.rows.filter((_, r) => r !== rowIdx) } : s,
      );
      return { ...prev, sheets, dirty: true };
    });
  };

  /** 保存修改：直接写回本地库登记的原文件（不复制副本） */
  const handleSave = async () => {
    if (!editor) return;
    if (!editor.path) {
      toast.warning('未登记文件路径，请通过「选择文件 / 选择文件夹 / 按路径导入」登记后保存');
      return;
    }
    setSaving(true);
    try {
      const info = await saveExcelFile({ path: editor.path, sheets: editor.sheets });
      setEditor((prev) => (prev ? { ...prev, dirty: false } : prev));
      toast.success(`已保存并覆盖原文件「${info.fileName}」（${formatSize(info.size)}）`);
      await refreshSaved();
    } catch (err: any) {
      const msg = err?.response?.data?.message || '保存失败';
      logger.error('Save excel failed', String(err));
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  /** 下载当前编辑的文件 */
  const handleDownloadEdited = () => {
    if (!editor) return;
    if (!editor.path) {
      toast.warning('未登记文件路径，无法下载');
      return;
    }
    downloadRpaFile(editor.path);
  };

  /** 从本地文件库移除记录（不删除原文件） */
  const handleDeleteSaved = async (file: RpaFileInfo) => {
    const confirmed = await openConfirm({
      title: '移出本地文件库',
      description: `确定将「${file.fileName}」移出本地文件库吗？仅移除记录，不会删除原文件。`,
      confirmText: '确认移除',
      cancelText: '取消',
      variant: 'destructive',
    });
    if (!confirmed) return;
    setDeleting(file.path);
    try {
      await deleteRpaFile(file.path);
      toast.success(`已移除「${file.fileName}」的记录`);
      await refreshSaved();
      if (editor?.path && editor.path === file.path) {
        setEditor(null);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || '移除失败';
      logger.error('Delete rpa file failed', String(err));
      toast.error(msg);
    } finally {
      setDeleting(null);
    }
  };

  /** 打开文件所在文件夹 */
  const handleOpenFolder = async (file: RpaFileInfo) => {
    setOpeningFolder(file.path);
    try {
      await openRpaFolder(file.path);
      toast.success(`已在文件管理器中打开：${file.directory}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || '打开文件夹失败');
    } finally {
      setOpeningFolder(null);
    }
  };

  /** 打开本地文件库索引所在目录 */
  const handleOpenLibrary = async () => {
    setOpeningLibrary(true);
    try {
      await openRpaLibraryFolder();
      toast.success('已打开本地文件库索引目录');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || '打开文件夹失败');
    } finally {
      setOpeningLibrary(false);
    }
  };

  const maxCols = editor
    ? Math.max(...editor.sheets.map((s) => Math.max(1, ...s.rows.map((r) => r.length))))
    : 0;

  return (
    <div className="min-h-full p-6 md:p-10">
      <BackgroundGlow variant="page" />

      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 flex items-center gap-2">
          <FileSpreadsheet className="w-6 h-6 text-amber-400" />
          RPA 管理
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          选择本地文件夹或 Excel 文件（系统文件窗口直接获取真实路径），读取表格内容，在线编辑修改并保存回原文件
        </p>
      </div>

      {/* 导入区 */}
      <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10 mb-6">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-50 flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-amber-400" />
            导入本地文件
          </CardTitle>
          <CardDescription className="text-zinc-400">
            点击按钮会弹出系统文件选择窗口，直接获取文件真实路径并登记；读取编辑并保存时直接写回原文件
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              onClick={handlePickFolder}
              disabled={picking !== null}
              className="bg-gradient-to-r from-amber-500 to-orange-600 border-0 text-white hover:opacity-90"
            >
              {picking === 'folder' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FolderOpen className="w-4 h-4 mr-2" />}
              选择文件夹
            </Button>
            <Button
              onClick={handlePickFile}
              disabled={picking !== null}
              variant="outline"
              className="border-white/10 text-zinc-300 hover:text-white hover:border-white/25"
            >
              {picking === 'file' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileUp className="w-4 h-4 mr-2" />}
              选择 Excel 文件
            </Button>
            <Button
              variant="ghost"
              onClick={refreshSaved}
              className="text-zinc-500 hover:text-white"
              disabled={loadingFiles}
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${loadingFiles ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </div>

          {/* 按路径登记导入 */}
          <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-3">
            <div className="flex items-center gap-2">
              <Input
                className="flex-1 bg-white/[0.03] border-white/10 text-zinc-200 placeholder:text-zinc-600"
                placeholder="粘贴文件或文件夹的绝对路径，如 D:\data\表格.xlsx"
                value={importPath}
                onChange={(e) => setImportPath(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleImportByPath();
                  }
                }}
              />
              <Button
                onClick={handleImportByPath}
                disabled={importing}
                className="bg-gradient-to-r from-amber-500 to-orange-600 border-0 text-white hover:opacity-90 shrink-0"
              >
                {importing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
                按路径导入
              </Button>
            </div>
            <p className="text-xs text-zinc-500 mt-2">
              也可手动粘贴路径批量登记；保存修改时将直接写回该路径的原文件，不会复制副本
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 本地文件库 */}
      <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10 mb-6">
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-lg text-zinc-50 flex items-center gap-2">
                <Save className="w-4 h-4 text-emerald-400" />
                本地文件库
              </CardTitle>
              <CardDescription className="text-zinc-400">
                已登记的文件（选择/导入即入记录）。读取编辑并保存时，直接写回原文件位置，不复制副本
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-white/10 text-zinc-300 hover:text-white hover:border-white/25"
              disabled={openingLibrary}
              onClick={handleOpenLibrary}
            >
              {openingLibrary ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <FolderOpen className="w-4 h-4 mr-1" />
              )}
              打开索引目录
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingFiles ? (
            <div className="flex items-center justify-center py-8 text-zinc-500 text-sm">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              加载中...
            </div>
          ) : savedFiles.length === 0 ? (
            <div className="py-8 text-center text-sm text-zinc-500">
              <Save className="w-8 h-8 mx-auto mb-2 text-zinc-600" />
              暂无登记的文件，使用上方「选择文件夹 / 选择 Excel 文件」添加
            </div>
          ) : (
            <div className="space-y-2">
              {savedFiles.map((file) => (
                <div
                  key={file.path}
                  className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-zinc-300 truncate">{file.fileName}</p>
                    <p className="text-xs text-zinc-500 flex items-center gap-1 flex-wrap">
                      <span
                        className="inline-flex items-center gap-0.5 font-mono text-[11px] text-zinc-400 truncate max-w-[46ch]"
                        title={file.directory}
                      >
                        <FolderOpen className="w-3 h-3 shrink-0" />
                        {file.directory}
                      </span>
                      <span>· {file.sheets.join(' / ')} · {formatSize(file.size)} · {formatTime(file.updatedAt)}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs border-white/10 text-amber-300 hover:border-amber-500/30"
                      title="打开文件所在文件夹"
                      disabled={openingFolder === file.path}
                      onClick={() => handleOpenFolder(file)}
                    >
                      {openingFolder === file.path ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <FolderOpen className="w-3 h-3" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs border-white/10 text-emerald-300 hover:border-emerald-500/30"
                      disabled={reading === file.fileName}
                      onClick={() => handleReadSaved(file)}
                    >
                      {reading === file.fileName ? <Loader2 className="w-3 h-3 animate-spin" /> : '读取'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs border-white/10 text-zinc-300 hover:border-white/25"
                      onClick={() => downloadRpaFile(file.path)}
                    >
                      <Download className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs border-white/10 text-rose-300 hover:border-rose-500/30"
                      title="移出本地库（不删除原文件）"
                      disabled={deleting === file.path}
                      onClick={() => handleDeleteSaved(file)}
                    >
                      {deleting === file.path ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 编辑器 */}
      {editor && (
        <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <CardTitle className="text-lg text-zinc-50 flex items-center gap-2">
                  <Table2 className="w-4 h-4 text-indigo-400" />
                  {editor.originalName}.xlsx
                  {editor.dirty && (
                    <Badge variant="outline" className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs">
                      有未保存修改
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-zinc-400 mt-1">
                  点击单元格直接编辑，支持增删行；保存后直接写回原文件并可下载
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="border-white/10 text-zinc-300 hover:text-white hover:border-white/25"
                  onClick={handleDownloadEdited}
                  title="下载当前文件（需先登记路径）"
                >
                  <Download className="w-4 h-4 mr-1" />
                  下载
                </Button>
                <Button
                  disabled={saving}
                  className="bg-gradient-to-r from-emerald-500 to-teal-600 border-0 text-white hover:opacity-90"
                  onClick={handleSave}
                >
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  保存修改
                </Button>
              </div>
            </div>

            {/* sheet tabs */}
            <div className="flex items-center gap-1.5 mt-4 flex-wrap">
              {editor.sheets.map((sheet, si) => (
                <button
                  key={`${sheet.name}-${si}`}
                  onClick={() => setEditor((prev) => (prev ? { ...prev, activeSheet: si } : prev))}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                    editor.activeSheet === si
                      ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/30'
                      : 'bg-white/[0.02] text-zinc-400 border border-white/10 hover:text-white'
                  }`}
                >
                  {sheet.name}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {(() => {
              const sheet = editor.sheets[editor.activeSheet];
              if (!sheet) return null;
              const rows = sheet.rows;
              const cols = Math.max(1, ...rows.map((r) => r.length));
              return (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs border-white/10 text-zinc-300 hover:border-white/25"
                      onClick={() => addRow(editor.activeSheet)}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      添加行
                    </Button>
                    <span className="text-xs text-zinc-500">
                      {rows.length} 行 × {cols} 列
                    </span>
                  </div>

                  <div className="overflow-auto rounded-xl border border-white/10 max-h-[520px]">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr>
                          <th className="sticky left-0 z-10 bg-slate-800 border-b border-r border-white/10 px-2 py-1.5 text-xs text-zinc-500 text-center w-10">
                            #
                          </th>
                          {Array.from({ length: cols }).map((_, c) => (
                            <th
                              key={c}
                              className="bg-slate-800/90 border-b border-r border-white/10 px-2 py-1.5 text-xs text-zinc-500 min-w-[120px] text-center"
                            >
                              {String.fromCharCode(65 + (c % 26))}
                              {c >= 26 ? Math.floor(c / 26) : ''}
                            </th>
                          ))}
                          <th className="bg-slate-800/90 border-b border-white/10 px-2 py-1.5 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, r) => (
                          <tr key={r} className={r === 0 ? 'bg-indigo-500/[0.06]' : 'hover:bg-white/[0.02]'}>
                            <td className="sticky left-0 z-10 bg-slate-800/90 border-b border-r border-white/10 px-2 py-1 text-xs text-zinc-500 text-center">
                              {r === 0 ? '表头' : r}
                            </td>
                            {Array.from({ length: cols }).map((_, c) => {
                              const value = row[c];
                              return (
                                <td key={c} className="border-b border-r border-white/5 px-1 py-0.5">
                                  <input
                                    className="w-full min-w-[120px] bg-transparent px-2 py-1 text-sm text-zinc-200 outline-none focus:bg-indigo-500/10 focus:rounded"
                                    value={value === null || value === undefined ? '' : String(value)}
                                    onChange={(e) =>
                                      updateCell(editor.activeSheet, r, c, e.target.value)
                                    }
                                  />
                                </td>
                              );
                            })}
                            <td className="border-b border-white/5 px-1 py-0.5 text-center">
                              {r > 0 && (
                                <button
                                  onClick={() => removeRow(editor.activeSheet, r)}
                                  className="text-zinc-600 hover:text-rose-400 transition-colors"
                                  aria-label={`删除第 ${r} 行`}
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {ConfirmDialog}
    </div>
  );
};

export default RpaManagerPage;
