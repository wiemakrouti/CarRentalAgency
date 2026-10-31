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
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          aria-label={`Effacer les filtres (${activeCount})`}
          className="gap-1.5 text-muted-foreground max-sm:h-9 max-sm:w-9 max-sm:p-0"
        >
          <X className="h-3.5 w-3.5" />
          {/* Just the cross on a phone, beside a search box that needs the width. */}
          <span className="max-sm:hidden">Effacer les filtres ({activeCount})</span>
        </Button>
      )}
    </div>
  );
}
