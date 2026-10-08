import { Bot, Zap, FileText, Settings } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';

const RpaConfigCard = () => {
  return (
    <Card className="bg-white/[0.03] backdrop-blur-xl border border-white/10">
      <CardHeader>
        <CardTitle className="text-lg text-zinc-50 flex items-center gap-2">
          <Settings className="w-4 h-4 text-zinc-400" />
          RPA 配置
        </CardTitle>
        <CardDescription className="text-zinc-400">
          服务连接状态
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Bot className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="text-sm text-zinc-200">影刀 RPA</div>
              <div className="text-xs text-zinc-500">自动化执行引擎</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-breathe" />
            已连接
          </div>
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Zap className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <div className="text-sm text-zinc-200">Kimi API</div>
              <div className="text-xs text-zinc-500">AI 内容生成</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-breathe" />
            已配置
          </div>
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <FileText className="w-4 h-4 text-indigo-300" />
            </div>
            <div>
              <div className="text-sm text-zinc-200">公众号</div>
              <div className="text-xs text-zinc-500">草稿发布通道</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-breathe" />
            已绑定
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-full border-white/10 text-zinc-300 hover:text-white hover:border-white/20 hover:bg-white/[0.05]"
        >
          <Settings className="w-3.5 h-3.5" />
          管理配置
        </Button>
      </CardContent>
    </Card>
  );
};

export default RpaConfigCard;
