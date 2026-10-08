import { Flame, Check } from 'lucide-react';
import type { LifeHabit, HabitRecord } from '@shared/api.interface';

function CircleProgress({
  completed,
  total,
  size = 140,
}: {
  completed: number;
  total: number;
  size?: number;
}) {
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = total > 0 ? completed / total : 0;
  const offset = circumference * (1 - pct);
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#habitProgress)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <defs>
          <linearGradient id="habitProgress" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-3xl font-semibold text-zinc-50">
          {completed}/{total}
        </div>
        <div className="text-xs text-zinc-500 mt-1">今日完成</div>
      </div>
    </div>
  );
}

interface HabitCheckInTabProps {
  habits: LifeHabit[];
  records: HabitRecord[];
  onToggle: (habitId: string) => void;
}

export default function HabitCheckInTab({
  habits,
  records,
  onToggle,
}: HabitCheckInTabProps) {
  const completedSet = new Set(
    records.filter((r) => r.completed).map((r) => r.habitId),
  );
  const completedCount = habits.filter((h) => completedSet.has(h.id)).length;

  return (
    <div className="space-y-6">
      <div
        className="glass-card rounded-2xl p-6 flex flex-col md:flex-row items-center gap-8"
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <CircleProgress completed={completedCount} total={habits.length} />
        <div className="flex-1 text-center md:text-left">
          <h3 className="text-lg font-semibold text-zinc-50 mb-2">
            今日进度
          </h3>
          <p className="text-sm text-zinc-400">
            {habits.length === 0
              ? '还没有添加任何习惯，去「习惯管理」添加吧'
              : completedCount === habits.length
              ? '太棒了！今天所有习惯都完成了 🎉'
              : `还有 ${habits.length - completedCount} 个习惯待完成，加油！`}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {habits.length === 0 ? (
          <div
            className="glass-card rounded-2xl p-12 text-center"
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <p className="text-zinc-400">
              还没有添加任何习惯，去「习惯管理」添加吧
            </p>
          </div>
        ) : (
          habits.map((habit) => {
            const isCompleted = completedSet.has(habit.id);
            return (
              <div
                key={habit.id}
                className="glass-card rounded-xl p-4 flex items-center gap-4 transition-all duration-300 hover:scale-[1.01]"
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  backdropFilter: 'blur(20px)',
                  border: `1px solid ${isCompleted ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
                }}
              >
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                  style={{ backgroundColor: habit.color || '#6366f1' }}
                >
                  <span>{habit.icon || '🎯'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-zinc-50">{habit.name}</div>
                  <div className="flex items-center gap-1 mt-0.5 text-xs text-zinc-500">
                    <Flame className="w-3 h-3 text-orange-400" />
                    <span>连续 {habit.streakCount} 天</span>
                  </div>
                </div>
                <button
                  onClick={() => onToggle(habit.id)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 flex-shrink-0 ${
                    isCompleted
                      ? 'bg-emerald-500 text-white'
                      : 'bg-transparent border-2 border-zinc-600 hover:border-zinc-400'
                  }`}
                  aria-label="toggle habit"
                >
                  {isCompleted && <Check className="w-4 h-4" />}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
