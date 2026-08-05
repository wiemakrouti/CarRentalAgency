import { AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ErrorStateProps = {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
};

export function ErrorState({
  title = 'Une erreur est survenue',
  description = 'Impossible de charger les données. Veuillez réessayer.',
  onRetry,
  retryLabel = 'Réessayer',
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex min-h-[280px] flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-destructive/30 bg-destructive/5 px-6 py-16 text-center',
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-6" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
