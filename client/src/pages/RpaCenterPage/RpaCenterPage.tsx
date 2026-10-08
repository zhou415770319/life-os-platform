import { useState, useCallback } from 'react';
import {
  Bot,
  Zap,
  Check,
  Clock,
  Loader2,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@client/src/components/ui/card';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@client/src/components/ui/select';
import { Input } from '@client/src/components/ui/input';
import { Button } from '@client/src/components/ui/button';
import BackgroundGlow from '@client/src/components/ui/background-glow';
import { formatDate } from '@client/src/utils/date';
import TaskHistoryList, {
  initialHistory,
  type HistoryTask,
} from './TaskHistoryList';
import RpaConfigCard from './RpaConfigCard';

type StepStatus = 'pending' | 'running' | 'done';

interface TaskStep {
  key: string;
  label: string;
  status: StepStatus;
}

const STEP_LABELS = ['主题分析', '大纲生成', '内容撰写', '格式优化', '发布到公众号'];

const RpaCenterPage = () => {
  const [topic, setTopic] = useState('');
  const [audience, setAudience] = useState('');
  const [style, setStyle] = useState('tech');
  const [wordCount, setWordCount] = useState('1000');
  const [isGenerating, setIsGenerating] = useState(false);
  const [steps, setSteps] = useState<TaskStep[]>(
    STEP_LABELS.map((label, idx) => ({
      key: `step-${idx}`,
      label,
      status: 'pending' as StepStatus,
    })),
  );
  const [history, setHistory] = useState<HistoryTask[]>(initialHistory);

  const runGeneration = useCallback(async () => {
    if (!topic.trim() || isGenerating) return;
    setIsGenerating(true);
    setSteps(STEP_LABELS.map((label, idx) => ({
      key: `step-${idx}`,
      label,
      status: 'pending' as StepStatus,
    })));

    for (let i = 0; i < STEP_LABELS.length; i++) {
      setSteps((prev) =>
        prev.map((s, idx) => (idx === i ? { ...s, status: 'running' } : s)),
      );
      await new Promise((resolve) => setTimeout(resolve, 900 + Math.random() * 700));
      setSteps((prev) =>
        prev.map((s, idx) => (idx === i ? { ...s, status: 'done' } : s)),
      );
    }

    const newTask: HistoryTask = {
      id: `t-${Date.now()}`,
      title: topic,
      status: '草稿',
      createdAt: formatDate(new Date().toISOString()),
    };
    setHistory((prev) => [newTask, ...prev].slice(0, 5));
    setIsGenerating(false);
  }, [topic, isGenerating]);

  const getStepIcon = (status: StepStatus) => {
    if (status === 'done') return <Check className="w-3.5 h-3.5" />;
    if (status === 'running') return <Loader2 className="w-3.5 h-3.5 animate-spin" />;
    return <Clock className="w-3.5 h-3.5" />;
  };

  const getStepColor = (status: StepStatus) => {
    if (status === 'done') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (status === 'running')
      return 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30 animate-pulse';
    return 'text-zinc-500 bg-white/[0.03] border-white/10';
  };

  return (
    <div className="min-h-full p-6 md:p-10">
      <BackgroundGlow variant="page" />

      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          智能创作中心控制台
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          影刀 RPA 联动 Kimi 生成公众号草稿
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/20 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-emerald-300" />
                </div>
                <div>
                  <CardTitle className="text-lg text-zinc-50">创作控制台</CardTitle>
                  <CardDescription className="text-zinc-400">
                    AI 自动生成并发布到公众号草稿箱
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">文章主题</label>
                <Input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="如：AI 时代下的产品经理如何转型"
                  className="bg-white/[0.03] border-white/10 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-zinc-400 mb-1.5 block">目标读者</label>
                  <Input
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    placeholder="如：互联网从业者"
                    className="bg-white/[0.03] border-white/10 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1.5 block">文章风格</label>
                  <Select value={style} onValueChange={setStyle}>
                    <SelectTrigger className="bg-white/[0.03] border-white/10 text-sm w-full">
                      <SelectValue placeholder="选择风格" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tech">技术干货</SelectItem>
                      <SelectItem value="life">生活随笔</SelectItem>
                      <SelectItem value="review">产品评测</SelectItem>
                      <SelectItem value="deep">深度分析</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-400 mb-2 block">字数选择</label>
                <div className="flex gap-2">
                  {['500', '1000', '2000', '3000'].map((num) => (
                    <button
                      key={num}
                      onClick={() => setWordCount(num)}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all border ${
                        wordCount === num
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                          : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-300'
                      }`}
                    >
                      {num} 字
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-white/5">
                <div className="flex items-center justify-between relative">
                  <div className="absolute top-4 left-0 right-0 h-px bg-white/10 -z-0" />
                  {steps.map((step, idx) => (
                    <div key={step.key} className="flex flex-col items-center gap-1.5 z-10">
                      <div
                        className={`w-8 h-8 rounded-full border flex items-center justify-center ${getStepColor(
                          step.status,
                        )}`}
                      >
                        {getStepIcon(step.status)}
                      </div>
                      <span
                        className={`text-[10px] whitespace-nowrap ${
                          step.status === 'done'
                            ? 'text-zinc-300'
                            : step.status === 'running'
                              ? 'text-cyan-300'
                              : 'text-zinc-500'
                        }`}
                      >
                        {step.label}
                      </span>
                      {idx < steps.length - 1 && <div className="hidden" />}
                    </div>
                  ))}
                </div>
              </div>

              <Button
                onClick={runGeneration}
                disabled={isGenerating || !topic.trim()}
                size="lg"
                className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 border-0 text-white hover:opacity-90 mt-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Bot className="w-4 h-4" />
                    一键生成公众号草稿
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <TaskHistoryList history={history} />
        </div>

        <div className="space-y-6">
          <RpaConfigCard />
        </div>
      </div>
    </div>
  );
};

export default RpaCenterPage;
