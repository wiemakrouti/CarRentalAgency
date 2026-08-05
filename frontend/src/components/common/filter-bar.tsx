import type { ReactNode } from 'react';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type FilterBarProps = {
  children: ReactNode;
  activeCount?: number;
  onClearAll?: () => void;
  className?: string;
};

export function FilterBar({ children, activeCount = 0, onClearAll, className }: FilterBarProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {children}
      {onClearAll && activeCount > 0 && (
        <Button variant="ghost" size="sm" onClick={onClearAll} className="gap-1.5 text-muted-foreground">
          <X className="h-3.5 w-3.5" />
          Effacer les filtres ({activeCount})
        </Button>
      )}
    </div>
  );
}
