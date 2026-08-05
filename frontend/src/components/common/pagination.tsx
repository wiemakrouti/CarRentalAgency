import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type PaginationProps = {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  siblingCount?: number;
  className?: string;
};

type PageToken = number | 'ellipsis';

function range(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

function getPageTokens(page: number, pageCount: number, siblingCount: number): PageToken[] {
  const totalVisible = siblingCount * 2 + 5;
  if (pageCount <= totalVisible) return range(1, pageCount);

  const leftSibling = Math.max(page - siblingCount, 1);
  const rightSibling = Math.min(page + siblingCount, pageCount);
  const showLeftEllipsis = leftSibling > 2;
  const showRightEllipsis = rightSibling < pageCount - 1;

  if (!showLeftEllipsis && showRightEllipsis) {
    return [...range(1, 3 + siblingCount * 2), 'ellipsis', pageCount];
  }
  if (showLeftEllipsis && !showRightEllipsis) {
    return [1, 'ellipsis', ...range(pageCount - (2 + siblingCount * 2), pageCount)];
  }
  return [1, 'ellipsis', ...range(leftSibling, rightSibling), 'ellipsis', pageCount];
}

export function Pagination({ page, pageCount, onPageChange, siblingCount = 1, className }: PaginationProps) {
  if (pageCount <= 1) return null;

  const tokens = getPageTokens(page, pageCount, siblingCount);

  return (
    <nav
      aria-label="Pagination"
      className={cn('flex items-center justify-between gap-4', className)}
    >
      <p className="text-sm text-muted-foreground">
        Page {page} sur {pageCount}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Page précédente"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {tokens.map((token, index) =>
          token === 'ellipsis' ? (
            <span
              key={`ellipsis-${index}`}
              className="flex h-9 w-9 items-center justify-center text-muted-foreground"
            >
              <MoreHorizontal className="h-4 w-4" />
            </span>
          ) : (
            <Button
              key={token}
              variant={token === page ? 'default' : 'ghost'}
              size="icon"
              onClick={() => onPageChange(token)}
              aria-current={token === page ? 'page' : undefined}
            >
              {token}
            </Button>
          ),
        )}

        <Button
          variant="outline"
          size="icon"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          aria-label="Page suivante"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}
