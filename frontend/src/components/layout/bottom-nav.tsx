import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Plus } from 'lucide-react';

import { cn } from '@/lib/utils';
import { navItemsFor, type NavItem } from '@/lib/navigation';
import { useAuth } from '@/providers/auth-context';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { CreateSheetActions } from './create-sheet-actions';

// The day-to-day modules, with the short label that fits a tab. The rest
// (finances, team, settings...) stays in the top bar's menu.
const TAB_LABELS: Record<string, string> = {
  '/': 'Accueil',
  '/rentals': 'Locations',
  '/cars': 'Voitures',
  '/clients': 'Clients',
};

// Phones and tablets only (the sidebar takes over from lg): the main modules
// within thumb reach, and in the middle a raised "+" that opens the quick
// creations.
export function BottomNav() {
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const tabs = Object.keys(TAB_LABELS)
    .map((path) => navItemsFor(user?.role).find((item) => item.path === path))
    .filter((item): item is NavItem => !!item);
  const middle = Math.ceil(tabs.length / 2);

  return (
    <nav
      aria-label="Navigation rapide"
      // Its own layer above the page: the raised "+" overlaps the bottom of
      // <main>, whose positioned bits (z-10 badges, sticky headers) would
      // otherwise paint over it.
      className="relative z-30 shrink-0 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <div className="mx-auto flex h-16 max-w-lg items-stretch">
        {tabs.slice(0, middle).map((item) => (
          <BottomNavLink key={item.path} item={item} />
        ))}

        <Sheet open={createOpen} onOpenChange={setCreateOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label="Créer"
              className="group flex flex-1 items-start justify-center focus-visible:outline-none"
            >
              {/* Lifted out of the bar, ringed in the page's background so it
                  reads as cut into the bar's top edge. */}
              <span className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-primary-foreground shadow-[0_12px_24px_-10px_hsl(var(--primary)/0.9)] ring-[5px] ring-background transition-transform active:scale-95 group-focus-visible:ring-ring dark:from-primary dark:to-primary">
                <Plus className="h-7 w-7" strokeWidth={2.25} />
              </span>
            </button>
          </SheetTrigger>
          {/* Just the shortcuts: no visible title or X — a tap outside
              closes the sheet. The handle only marks it as a sheet. */}
          <SheetContent
            side="bottom"
            showCloseButton={false}
            // No focus jump onto the first shortcut — it would open with a
            // focus ring on "Nouvelle location", as if already chosen.
            onOpenAutoFocus={(event) => event.preventDefault()}
            className="rounded-t-3xl px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3"
          >
            <span aria-hidden className="mx-auto mb-4 block h-1.5 w-10 rounded-full bg-muted-foreground/25" />
            <SheetHeader className="sr-only">
              <SheetTitle>Créer</SheetTitle>
              <SheetDescription>Choisissez ce que vous voulez créer.</SheetDescription>
            </SheetHeader>
            <CreateSheetActions onSelect={() => setCreateOpen(false)} />
          </SheetContent>
        </Sheet>

        {tabs.slice(middle).map((item) => (
          <BottomNavLink key={item.path} item={item} />
        ))}
      </div>
    </nav>
  );
}

function BottomNavLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      className={({ isActive }) =>
        cn(
          'flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
          isActive ? 'text-primary' : 'text-muted-foreground',
        )
      }
    >
      <item.icon className="h-5 w-5" />
      {TAB_LABELS[item.path]}
    </NavLink>
  );
}
