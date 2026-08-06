import { Link, useMatches, useNavigate } from 'react-router-dom';
import { Bell, LogOut, Search, User } from 'lucide-react';

import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MobileNav } from '@/components/layout/mobile-nav';
import { ThemeToggle } from '@/components/layout/theme-toggle';

type RouteHandle = { breadcrumb?: string };

type TopbarProps = {
  onOpenCommandPalette: () => void;
};

export function Topbar({ onOpenCommandPalette }: TopbarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const matches = useMatches();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }
  const crumbs = matches
    .filter((match) => (match.handle as RouteHandle | undefined)?.breadcrumb)
    .map((match) => ({
      path: match.pathname,
      label: (match.handle as RouteHandle).breadcrumb as string,
    }));

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background px-4 md:px-6">
      <MobileNav />

      {crumbs.length > 0 && (
        <Breadcrumb className="hidden min-w-0 sm:block">
          <BreadcrumbList>
            {crumbs.map((crumb, index) => (
              <span key={crumb.path} className="flex items-center gap-1.5">
                <BreadcrumbItem>
                  {index === crumbs.length - 1 ? (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link to={crumb.path}>{crumb.label}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {index < crumbs.length - 1 && <BreadcrumbSeparator />}
              </span>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      )}

      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="outline"
          onClick={onOpenCommandPalette}
          className="hidden w-64 justify-start gap-2 text-muted-foreground lg:flex"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Rechercher...</span>
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium">
            Ctrl K
          </kbd>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenCommandPalette}
          className="lg:hidden"
          aria-label="Rechercher"
        >
          <Search className="h-4 w-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Notifications">
              <Bell className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">
              Aucune notification pour le moment.
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full" aria-label="Compte">
              <Avatar className="h-8 w-8">
                <AvatarFallback>
                  <User className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="truncate">{user?.fullName ?? 'Compte'}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Profil</DropdownMenuItem>
            <DropdownMenuItem>Paramètres</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              <LogOut className="h-4 w-4" />
              Déconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
