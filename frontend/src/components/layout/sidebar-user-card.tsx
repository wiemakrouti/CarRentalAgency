import { Link } from 'react-router-dom';

import { useAuth } from '@/providers/auth-context';
import { ROLE_LABELS } from '@/lib/role-labels';

// The signed-in user (director or employee) at the foot of the navigation — the desktop sidebar
// and the mobile menu both show it, and it opens the account settings.
export function SidebarUserCard({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  const initial = user?.fullName?.trim()?.charAt(0)?.toUpperCase() || 'A';

  return (
    <Link
      to="/profile?tab=account"
      onClick={onNavigate}
      className="flex items-center gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-sidebar-accent/60"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-primary-700 text-xs font-bold text-primary-foreground shadow-sm">
        {initial}
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-xs font-semibold text-sidebar-foreground">{user?.fullName ?? 'Administrateur'}</span>
        <span className="truncate text-[11px] text-sidebar-foreground/50">
          {ROLE_LABELS[user?.role ?? 'ADMIN']}
        </span>
      </div>
    </Link>
  );
}
