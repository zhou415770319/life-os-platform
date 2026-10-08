import { Puzzle, Layers, Code2, Sparkles } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@client/src/components/ui/tabs';
import BackgroundGlow from '@client/src/components/ui/background-glow';
import MechanismTab from './MechanismTab';
import DevelopmentTab from './DevelopmentTab';
import BuiltInTab from './BuiltInTab';

const PluginCenterPage = () => {
  return (
    <div className="min-h-full p-6 md:p-10">
      <BackgroundGlow variant="page" />

      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 flex items-center gap-2">
          <Puzzle className="w-6 h-6 text-purple-400" />
          插件中心
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          了解 Life-OS 插件机制，探索内置插件，学习如何开发自己的插件
        </p>
      </div>

      <Tabs defaultValue="mechanism" className="w-full">
        <TabsList className="mb-6 bg-white/[0.03] border border-white/10 p-1">
          <TabsTrigger value="mechanism" className="data-[state=active]:bg-white/10">
            <Layers className="w-4 h-4 mr-2" />
            插件机制
          </TabsTrigger>
          <TabsTrigger value="development" className="data-[state=active]:bg-white/10">
            <Code2 className="w-4 h-4 mr-2" />
            开发指南
          </TabsTrigger>
          <TabsTrigger value="built-in" className="data-[state=active]:bg-white/10">
            <Sparkles className="w-4 h-4 mr-2" />
            内置插件
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mechanism">
          <MechanismTab />
        </TabsContent>
        <TabsContent value="development">
          <DevelopmentTab />
        </TabsContent>
        <TabsContent value="built-in">
          <BuiltInTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PluginCenterPage;
