import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Scale, Activity, Moon, Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@client/src/components/ui/dialog';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { Textarea } from '@client/src/components/ui/textarea';
import type { HealthRecordType } from '@shared/api.interface';
import { createHealthRecord } from '@client/src/api/health';
import type { CreateHealthRecordDto } from '@client/src/api/health';

const EXERCISE_TYPES = ['跑步', '力量训练', '瑜伽', '游泳', '骑行', '其他'];
const INTENSITY_OPTIONS = [
  { value: 'low', label: '低强度' },
  { value: 'medium', label: '中强度' },
  { value: 'high', label: '高强度' },
];

interface HealthFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordType: HealthRecordType;
}

const dialogTitles: Record<HealthRecordType, string> = {
  body: '记录身体数据',
  exercise: '记录运动',
  sleep: '记录睡眠',
};

export default function HealthFormDialog({
  open,
  onOpenChange,
  recordType,
}: HealthFormDialogProps) {
  const queryClient = useQueryClient();

  const [recordDate, setRecordDate] = useState(
    new Date().toISOString().split('T')[0],
  );
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [exerciseType, setExerciseType] = useState('');
  const [duration, setDuration] = useState('');
  const [intensity, setIntensity] = useState('');
  const [calories, setCalories] = useState('');
  const [sleepHours, setSleepHours] = useState('');
  const [sleepQuality, setSleepQuality] = useState('');
  const [note, setNote] = useState('');

  const resetForm = () => {
    setRecordDate(new Date().toISOString().split('T')[0]);
    setWeight('');
    setBodyFat('');
    setSystolic('');
    setDiastolic('');
    setHeartRate('');
    setExerciseType('');
    setDuration('');
    setIntensity('');
    setCalories('');
    setSleepHours('');
    setSleepQuality('');
    setNote('');
  };

  const createMutation = useMutation({
    mutationFn: (data: CreateHealthRecordDto) => createHealthRecord(data),
    onSuccess: () => {
      toast.success('记录成功');
      queryClient.invalidateQueries({ queryKey: ['healthRecords'] });
      queryClient.invalidateQueries({ queryKey: ['healthSummary'] });
      onOpenChange(false);
      resetForm();
    },
    onError: (err: Error) => {
      toast.error('记录失败: ' + (err.message || '未知错误'));
    },
  });

  const handleSubmit = () => {
    if (!recordDate) {
      toast.error('请选择日期');
      return;
    }

    const dto: CreateHealthRecordDto = {
      recordType,
      recordDate,
      metrics: {},
      note: note || undefined,
    };

    if (recordType === 'body') {
      if (weight) dto.metrics.weight = Number(weight);
      if (bodyFat) dto.metrics.bodyFat = Number(bodyFat);
      if (systolic) dto.metrics.bloodPressureSystolic = Number(systolic);
      if (diastolic) dto.metrics.bloodPressureDiastolic = Number(diastolic);
      if (heartRate) dto.metrics.heartRate = Number(heartRate);
    } else if (recordType === 'exercise') {
      if (!exerciseType) {
        toast.error('请选择运动类型');
        return;
      }
      dto.metrics.exerciseType = exerciseType;
      if (duration) dto.metrics.durationMinutes = Number(duration);
      if (intensity) dto.metrics.intensity = intensity;
      if (calories) dto.metrics.calories = Number(calories);
    } else if (recordType === 'sleep') {
      if (sleepHours) dto.metrics.sleepHours = Number(sleepHours);
      if (sleepQuality) dto.metrics.sleepQuality = Number(sleepQuality);
    }

    createMutation.mutate(dto);
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) resetForm();
    onOpenChange(v);
  };

  const iconForType = () => {
    if (recordType === 'body')
      return <Scale className="w-4 h-4 text-rose-400" />;
    if (recordType === 'exercise')
      return <Activity className="w-4 h-4 text-orange-400" />;
    return <Moon className="w-4 h-4 text-indigo-400" />;
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-zinc-900/95 border-white/10 backdrop-blur-xl text-zinc-100 max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {iconForType()}
            {dialogTitles[recordType]}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          <div>
            <label className="text-xs text-zinc-400 block mb-1.5">日期</label>
            <Input
              type="date"
              value={recordDate}
              onChange={(e) => setRecordDate(e.target.value)}
              className="border-white/10 text-zinc-100 bg-white/[0.02]"
            />
          </div>

          {recordType === 'body' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 block mb-1.5">
                    体重 (kg)
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="65.5"
                    className="border-white/10 text-zinc-100 bg-white/[0.02]"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 block mb-1.5">
                    体脂率 (%)
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    value={bodyFat}
                    onChange={(e) => setBodyFat(e.target.value)}
                    placeholder="18.5"
                    className="border-white/10 text-zinc-100 bg-white/[0.02]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 block mb-1.5">
                    收缩压
                  </label>
                  <Input
                    type="number"
                    value={systolic}
                    onChange={(e) => setSystolic(e.target.value)}
                    placeholder="120"
                    className="border-white/10 text-zinc-100 bg-white/[0.02]"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 block mb-1.5">
                    舒张压
                  </label>
                  <Input
                    type="number"
                    value={diastolic}
                    onChange={(e) => setDiastolic(e.target.value)}
                    placeholder="80"
                    className="border-white/10 text-zinc-100 bg-white/[0.02]"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1.5">
                  心率 (次/分)
                </label>
                <Input
                  type="number"
                  value={heartRate}
                  onChange={(e) => setHeartRate(e.target.value)}
                  placeholder="70"
                  className="border-white/10 text-zinc-100 bg-white/[0.02]"
                />
              </div>
            </>
          )}

          {recordType === 'exercise' && (
            <>
              <div>
                <label className="text-xs text-zinc-400 block mb-1.5">
                  运动类型
                </label>
                <Select value={exerciseType} onValueChange={setExerciseType}>
                  <SelectTrigger className="border-white/10 text-zinc-100 bg-white/[0.02]">
                    <SelectValue placeholder="选择运动类型" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900/95 border-white/10 text-zinc-200 backdrop-blur-xl">
                    {EXERCISE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 block mb-1.5">
                    时长 (分钟)
                  </label>
                  <Input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="30"
                    className="border-white/10 text-zinc-100 bg-white/[0.02]"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 block mb-1.5">
                    强度
                  </label>
                  <Select value={intensity} onValueChange={setIntensity}>
                    <SelectTrigger className="border-white/10 text-zinc-100 bg-white/[0.02]">
                      <SelectValue placeholder="选择强度" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900/95 border-white/10 text-zinc-200 backdrop-blur-xl">
                      {INTENSITY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1.5">
                  消耗卡路里 (kcal)
                </label>
                <Input
                  type="number"
                  value={calories}
                  onChange={(e) => setCalories(e.target.value)}
                  placeholder="250"
                  className="border-white/10 text-zinc-100 bg-white/[0.02]"
                />
              </div>
            </>
          )}

          {recordType === 'sleep' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 block mb-1.5">
                    睡眠时长 (小时)
                  </label>
                  <Input
                    type="number"
                    step="0.5"
                    value={sleepHours}
                    onChange={(e) => setSleepHours(e.target.value)}
                    placeholder="7.5"
                    className="border-white/10 text-zinc-100 bg-white/[0.02]"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 block mb-1.5">
                    睡眠质量 (1-5)
                  </label>
                  <Select
                    value={sleepQuality}
                    onValueChange={setSleepQuality}
                  >
                    <SelectTrigger className="border-white/10 text-zinc-100 bg-white/[0.02]">
                      <SelectValue placeholder="选择评分" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900/95 border-white/10 text-zinc-200 backdrop-blur-xl">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} 星
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="text-xs text-zinc-400 block mb-1.5">备注</label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="有什么想说的..."
              className="border-white/10 text-zinc-100 bg-white/[0.02] min-h-[80px] resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-white/10 text-zinc-300 hover:bg-white/5 hover:text-white"
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createMutation.isPending}
            className="bg-gradient-to-r from-rose-500 to-orange-500 text-white border-0 hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            {createMutation.isPending ? '保存中...' : '保存记录'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
