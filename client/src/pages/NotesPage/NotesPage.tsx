import { useQuery, useQueryClient } from '@tanstack/react-query';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import { notesApi } from '@client/src/api';
import BackgroundGlow from '@client/src/components/ui/background-glow';
import type {
  LifeNote,
  LifePrinciple,
  QuickLink,
} from '@shared/api.interface';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import NotesListTab from './NotesListTab';
import PrinciplesTab from './PrinciplesTab';
import QuickLinksTab from './QuickLinksTab';

export default function NotesPage() {
  const queryClient = useQueryClient();

  const { data: notes = [], isLoading: notesLoading } = useQuery({
    queryKey: ['notes'],
    queryFn: async () => {
      const res = await notesApi.getNotes();
      return res.items;
    },
  });

  const { data: principles = [], isLoading: principlesLoading } = useQuery({
    queryKey: ['principles'],
    queryFn: async () => {
      const res = await notesApi.getPrinciples();
      return res.items;
    },
  });

  const { data: quickLinks = [], isLoading: linksLoading } = useQuery({
    queryKey: ['quick-links'],
    queryFn: async () => {
      const res = await notesApi.getQuickLinks();
      return res.items;
    },
  });

  const isLoading = notesLoading || principlesLoading || linksLoading;

  const handleNoteCreated = (_note: LifeNote) => {
    queryClient.invalidateQueries({ queryKey: ['notes'] });
  };

  const handleNoteUpdated = (_note: LifeNote) => {
    queryClient.invalidateQueries({ queryKey: ['notes'] });
  };

  const handleNoteDeleted = (_id: string) => {
    queryClient.invalidateQueries({ queryKey: ['notes'] });
  };

  const handlePrincipleCreated = (_p: LifePrinciple) => {
    queryClient.invalidateQueries({ queryKey: ['principles'] });
  };

  const handlePrincipleDeleted = (_id: string) => {
    queryClient.invalidateQueries({ queryKey: ['principles'] });
  };

  const handleLinkCreated = (_link: QuickLink) => {
    queryClient.invalidateQueries({ queryKey: ['quick-links'] });
  };

  const handleLinkDeleted = (_id: string) => {
    queryClient.invalidateQueries({ queryKey: ['quick-links'] });
  };

  if (isLoading) {
    return (
      <div className="p-6 md:p-10 min-h-screen flex items-center justify-center">
        <div className="text-zinc-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 min-h-screen relative overflow-hidden">
      <BackgroundGlow variant="page" />

      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          认知看板与数字资产
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          个人闪念笔记、核心人生原则库、高频快速链接集合
        </p>
      </div>

      <Tabs defaultValue="notes" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="notes">闪念笔记</TabsTrigger>
          <TabsTrigger value="principles">原则库</TabsTrigger>
          <TabsTrigger value="links">快速链接</TabsTrigger>
        </TabsList>

        <TabsContent value="notes">
          <NotesListTab
            notes={notes}
            onCreated={handleNoteCreated}
            onUpdated={handleNoteUpdated}
            onDeleted={handleNoteDeleted}
          />
        </TabsContent>

        <TabsContent value="principles">
          <PrinciplesTab
            principles={principles}
            onCreated={handlePrincipleCreated}
            onDeleted={handlePrincipleDeleted}
          />
        </TabsContent>

        <TabsContent value="links">
          <QuickLinksTab
            links={quickLinks}
            onCreated={handleLinkCreated}
            onDeleted={handleLinkDeleted}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
