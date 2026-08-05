import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

type LoadingStateProps = {
  message?: string;
  className?: string;
};

export function LoadingState({ message = 'Chargement...', className }: LoadingStateProps) {
  return (
    <div
      role="status"
      className={cn(
        'flex min-h-[280px] flex-1 flex-col items-center justify-center gap-3 text-center',
        className,
      )}
    >
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
