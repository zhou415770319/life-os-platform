import { useState } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import { Zap, Target } from 'lucide-react';
import { habitsApi } from '@client/src/api';
import type { EnergyRecord, CreateEnergyDto } from '@shared/api.interface';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';

const MOODS = [
  { emoji: '😊', label: '愉悦', value: 'happy' },
  { emoji: '😐', label: '平静', value: 'neutral' },
  { emoji: '😔', label: '低落', value: 'sad' },
  { emoji: '😤', label: '烦躁', value: 'angry' },
  { emoji: '🥱', label: '疲惫', value: 'tired' },
];

interface EnergyTabProps {
  records: EnergyRecord[];
  today: string;
  onAdd: (record: EnergyRecord) => void;
}

export default function EnergyTab({ records, today, onAdd }: EnergyTabProps) {
  const [energyLevel, setEnergyLevel] = useState([7]);
  const [focusLevel, setFocusLevel] = useState([6]);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const maxEnergy = Math.max(...records.map((r) => r.energyLevel), 10);

  const handleSave = async () => {
    setSaving(true);
    try {
      const dto: CreateEnergyDto = {
        recordDate: today,
        energyLevel: energyLevel[0],
        focusLevel: focusLevel[0],
        mood: selectedMood ?? undefined,
        note: note.trim() || undefined,
      };
      const record = await habitsApi.createEnergyRecord(dto);
      onAdd(record);
      setNote('');
      setSelectedMood(null);
      setEnergyLevel([7]);
      setFocusLevel([6]);
      toast.success('精力记录已保存');
    } catch (err) {
      logger.error('Save energy failed', JSON.stringify(err));
      toast.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div
        className="glass-card rounded-2xl p-6"
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <h3 className="text-lg font-semibold text-zinc-50 mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-400" />
          最近 7 天精力概览
        </h3>
        {records.length === 0 ? (
          <p className="text-sm text-zinc-500">暂无记录</p>
        ) : (
          <div className="flex items-end gap-2 h-32">
            {records.map((record) => (
              <div
                key={record.id}
                className="flex-1 flex flex-col items-center gap-2"
              >
                <div
                  className="w-full rounded-t-md transition-all duration-500"
                  style={{
                    height: `${(record.energyLevel / maxEnergy) * 100}%`,
                    minHeight: '4px',
                    background: 'linear-gradient(180deg, #6366f1, #a855f7)',
                  }}
                />
                <span className="text-xs text-zinc-500">
                  {record.recordDate.slice(5)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        className="glass-card rounded-2xl p-6 space-y-5"
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <h3 className="text-lg font-semibold text-zinc-50 flex items-center gap-2">
          <Target className="w-5 h-5 text-indigo-400" />
          今日记录
        </h3>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm text-zinc-400">能量等级</label>
            <span className="text-sm font-medium text-zinc-200">
              {energyLevel[0]} / 10
            </span>
          </div>
          <Slider value={energyLevel} onValueChange={setEnergyLevel} max={10} step={1} />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm text-zinc-400">专注等级</label>
            <span className="text-sm font-medium text-zinc-200">
              {focusLevel[0]} / 10
            </span>
          </div>
          <Slider value={focusLevel} onValueChange={setFocusLevel} max={10} step={1} />
        </div>

        <div className="space-y-3">
          <label className="text-sm text-zinc-400 block">心情</label>
          <div className="flex gap-2 flex-wrap">
            {MOODS.map((mood) => (
              <button
                key={mood.value}
                onClick={() =>
                  setSelectedMood(selectedMood === mood.value ? null : mood.value)
                }
                className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-all ${
                  selectedMood === mood.value
                    ? 'bg-primary/20 border border-primary/40 text-zinc-50'
                    : 'bg-white/5 border border-transparent text-zinc-400 hover:bg-white/10'
                }`}
              >
                <span className="text-lg">{mood.emoji}</span>
                <span>{mood.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-sm text-zinc-400 block">备注</label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="记录今天的状态..."
            className="min-h-[80px]"
          />
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? '保存中...' : '保存记录'}
        </Button>
      </div>

      <div
        className="glass-card rounded-2xl p-6"
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <h3 className="text-lg font-semibold text-zinc-50 mb-4">历史记录</h3>
        {records.length === 0 ? (
          <p className="text-sm text-zinc-500">暂无历史记录</p>
        ) : (
          <div className="space-y-3">
            {records.map((record) => {
              const mood = MOODS.find((m) => m.value === record.mood);
              return (
                <div
                  key={record.id}
                  className="flex items-center gap-4 p-3 rounded-lg bg-white/[0.02] border border-white/[0.05]"
                >
                  <div className="text-2xl">{mood?.emoji || '😐'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-zinc-200">
                      {record.recordDate}
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      能量 {record.energyLevel} · 专注 {record.focusLevel}
                      {record.note ? ` · ${record.note}` : ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
