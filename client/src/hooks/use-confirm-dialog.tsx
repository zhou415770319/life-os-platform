import { useState, useCallback } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@client/src/components/ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogOptions {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
}

interface ConfirmDialogState extends ConfirmDialogOptions {
  open: boolean;
  onConfirm: () => void;
}

export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmDialogState>({
    open: false,
    title: '',
    description: '',
    confirmText: '确认',
    cancelText: '取消',
    variant: 'default',
    onConfirm: () => {},
  });

  const openConfirm = useCallback((options: ConfirmDialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        open: true,
        ...options,
        onConfirm: () => {
          setState((prev) => ({ ...prev, open: false }));
          resolve(true);
        },
      });
    });
  }, []);

  const handleCancel = useCallback(() => {
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  const ConfirmDialog = (
    <AlertDialog open={state.open} onOpenChange={handleCancel}>
      <AlertDialogContent className="bg-zinc-900 border-white/10 text-zinc-50">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle
              className={`w-5 h-5 ${state.variant === 'destructive' ? 'text-red-400' : 'text-amber-400'}`}
            />
            {state.title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-zinc-400 whitespace-pre-line">
            {state.description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="bg-transparent border-white/10 text-zinc-300 hover:bg-white/5">
            {state.cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={state.onConfirm}
            className={
              state.variant === 'destructive'
                ? 'bg-red-500 hover:bg-red-600 text-white border-0'
                : 'bg-indigo-500 hover:bg-indigo-600 text-white border-0'
            }
          >
            {state.confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { openConfirm, ConfirmDialog };
}
