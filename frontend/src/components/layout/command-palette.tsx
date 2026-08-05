import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CarFront, FilePlus2, UserPlus, UserRound } from 'lucide-react';

import { navItems } from '@/lib/navigation';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';

const recentClients = ['Ahmed Ben Ali', 'Sarra Meddeb', 'Karim Trabelsi'];
const recentCars = ['Renault Clio V — 123 TUN 4567', 'Peugeot 208 — 987 TUN 1234'];
const quickActions = [
  { label: 'Nouvelle location', icon: FilePlus2 },
  { label: 'Nouveau client', icon: UserPlus },
  { label: 'Nouvelle voiture', icon: CarFront },
];

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenChange(!open);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  const goTo = (path: string) => {
    navigate(path);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Palette de commandes</DialogTitle>
        <Command>
          <CommandInput placeholder="Rechercher une page, un client, une voiture..." />
          <CommandList>
            <CommandEmpty>Aucun résultat.</CommandEmpty>

            <CommandGroup heading="Navigation">
              {navItems.map((item) => (
                <CommandItem key={item.path} onSelect={() => goTo(item.path)}>
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Clients récents">
              {recentClients.map((name) => (
                <CommandItem key={name} onSelect={() => onOpenChange(false)}>
                  <UserRound className="h-4 w-4" />
                  {name}
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Voitures récentes">
              {recentCars.map((label) => (
                <CommandItem key={label} onSelect={() => onOpenChange(false)}>
                  <CarFront className="h-4 w-4" />
                  {label}
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Actions rapides">
              {quickActions.map((action) => (
                <CommandItem key={action.label} onSelect={() => onOpenChange(false)}>
                  <action.icon className="h-4 w-4" />
                  {action.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
