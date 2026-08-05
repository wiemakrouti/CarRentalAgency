import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type PageContainerProps = {
  children: ReactNode;
  className?: string;
};

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div className={cn('flex flex-1 flex-col gap-6 p-6 md:p-8', className)}>{children}</div>
  );
}
