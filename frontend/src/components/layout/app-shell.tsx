import { useState } from 'react';
import { Outlet } from 'react-router-dom';

import { useSidebarCollapsed } from '@/hooks/use-sidebar-collapsed';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { CommandPalette } from '@/components/layout/command-palette';

export function AppShell() {
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  const [commandOpen, setCommandOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background lg:gap-3 lg:p-3">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Aller au contenu principal
      </a>

      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden lg:rounded-3xl lg:border lg:border-border lg:shadow-elevation">
        <Topbar onOpenCommandPalette={() => setCommandOpen(true)} />
        <main id="main-content" className="flex flex-1 flex-col overflow-y-auto">
          <Outlet />
        </main>
      </div>

      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}
