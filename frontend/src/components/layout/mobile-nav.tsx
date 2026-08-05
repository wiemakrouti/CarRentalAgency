import { useState } from 'react';
import { CarFront, Menu } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { SidebarNav } from '@/components/layout/sidebar-nav';

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Ouvrir le menu">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 bg-sidebar p-0 text-sidebar-foreground">
        <SheetHeader className="flex h-16 flex-row items-center gap-2 space-y-0 border-b border-sidebar-border px-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <CarFront className="h-4 w-4" />
          </div>
          <SheetTitle className="text-sm font-semibold text-sidebar-foreground">
            Agence de Location
          </SheetTitle>
        </SheetHeader>
        <div className="py-4">
          <SidebarNav onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
