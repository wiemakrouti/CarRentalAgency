import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Bell,
  Calendar,
  CarFront,
  CheckCircle2,
  ChevronDown,
  Info,
  Loader2,
  Mail,
  MoreHorizontal,
  Settings,
  User,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';

import { useTheme } from '@/providers/theme-provider';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

import { SearchBar } from '@/components/common/search-bar';
import { FilterBar } from '@/components/common/filter-bar';
import { Pagination } from '@/components/common/pagination';
import { EmptyState } from '@/components/common/empty-state';
import { LoadingState } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-state';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { PageHeader } from '@/components/common/page-header';
import { KpiCard } from '@/components/common/kpi-card';
import { ChartCard } from '@/components/common/chart-card';

const sections = [
  { id: 'colors', label: 'Couleurs' },
  { id: 'typography', label: 'Typographie' },
  { id: 'elevation', label: 'Rayons & ombres' },
  { id: 'buttons', label: 'Boutons' },
  { id: 'forms', label: 'Champs de formulaire' },
  { id: 'badges', label: 'Badges & alertes' },
  { id: 'cards', label: 'Cartes' },
  { id: 'list-controls', label: 'Recherche, filtres & pagination' },
  { id: 'table', label: 'Tableau' },
  { id: 'tabs-accordion', label: 'Onglets & accordéon' },
  { id: 'skeleton', label: 'États de chargement' },
  { id: 'overlays', label: 'Tooltip & popover' },
  { id: 'dialogs', label: 'Modales & confirmation' },
  { id: 'menus', label: 'Menus' },
  { id: 'command', label: 'Palette de commandes' },
  { id: 'navigation', label: 'Breadcrumb & avatar' },
  { id: 'toast', label: 'Notifications' },
  { id: 'composites', label: 'Composants réutilisables' },
  { id: 'misc', label: 'Divers' },
];

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="rounded-xl border border-border bg-card p-6 shadow-xs">{children}</div>
    </section>
  );
}

function Swatch({ name, className }: { name: string; className: string }) {
  return (
    <div className="space-y-1.5">
      <div className={cn('h-14 w-full rounded-lg border border-border', className)} />
      <p className="text-xs font-medium text-foreground">{name}</p>
    </div>
  );
}

function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
      {(['light', 'dark', 'system'] as const).map((option) => (
        <button
          key={option}
          onClick={() => setTheme(option)}
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            theme === option
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

const mockCars = [
  { id: 1, model: 'Renault Clio V', plate: '123 TUN 4567', status: 'available' as const, rate: '85 DT' },
  { id: 2, model: 'Peugeot 208', plate: '987 TUN 1234', status: 'rented' as const, rate: '95 DT' },
  { id: 3, model: 'Volkswagen Golf 8', plate: '456 TUN 7890', status: 'maintenance' as const, rate: '110 DT' },
];

const statusVariant = {
  available: 'success',
  rented: 'default',
  maintenance: 'warning',
} as const;

const statusLabel = {
  available: 'Disponible',
  rented: 'Louée',
  maintenance: 'Maintenance',
};

export function DesignSystemPage() {
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(4);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Environnement de développement
            </p>
            <h1 className="text-xl font-semibold tracking-tight">Design System</h1>
          </div>
          <ThemeSwitcher />
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-10 px-6 py-8">
        <nav className="sticky top-24 hidden h-fit w-48 shrink-0 space-y-1 lg:block">
          {sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="block rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {s.label}
            </a>
          ))}
        </nav>

        <main className="min-w-0 flex-1 space-y-12">
          <Section id="colors" title="Couleurs" description="Palette sémantique — Primaire (Bleu), Accent (Émeraude), Neutre (Zinc), plus les couleurs de statut.">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              <Swatch name="Primary" className="bg-primary" />
              <Swatch name="Accent" className="bg-accent" />
              <Swatch name="Secondary" className="bg-secondary" />
              <Swatch name="Muted" className="bg-muted" />
              <Swatch name="Success" className="bg-success" />
              <Swatch name="Warning" className="bg-warning" />
              <Swatch name="Destructive" className="bg-destructive" />
              <Swatch name="Card" className="bg-card" />
            </div>
            <Separator className="my-6" />
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Palette des graphiques
            </p>
            <div className="grid grid-cols-5 gap-4">
              <Swatch name="chart-1" className="bg-chart-1" />
              <Swatch name="chart-2" className="bg-chart-2" />
              <Swatch name="chart-3" className="bg-chart-3" />
              <Swatch name="chart-4" className="bg-chart-4" />
              <Swatch name="chart-5" className="bg-chart-5" />
            </div>
          </Section>

          <Section id="typography" title="Typographie" description="Police Inter, échelle de titres et de texte.">
            <div className="space-y-3">
              <h1 className="text-3xl font-bold tracking-tight">Titre H1 — Gestion des voitures</h1>
              <h2 className="text-2xl font-semibold tracking-tight">Titre H2 — Détails de la location</h2>
              <h3 className="text-xl font-semibold">Titre H3 — Informations client</h3>
              <h4 className="text-base font-semibold">Titre H4 — Section</h4>
              <p className="text-base text-foreground">
                Texte courant — Le tableau de bord affiche les indicateurs clés de l'agence.
              </p>
              <p className="text-sm text-muted-foreground">
                Texte secondaire — Utilisé pour les descriptions et légendes.
              </p>
              <p className="text-xs text-muted-foreground">Texte petit — Métadonnées, horodatages.</p>
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">code inline</code>
            </div>
          </Section>

          <Section id="elevation" title="Rayons & ombres" description="Échelle de border-radius et d'élévation.">
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              {(
                [
                  { name: 'sm', className: 'rounded-sm' },
                  { name: 'md', className: 'rounded-md' },
                  { name: 'lg', className: 'rounded-lg' },
                  { name: 'xl', className: 'rounded-xl' },
                ] as const
              ).map((r) => (
                <div key={r.name} className="space-y-2 text-center">
                  <div className={cn('h-16 w-full border border-border bg-secondary', r.className)} />
                  <p className="text-xs text-muted-foreground">rounded-{r.name}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 grid grid-cols-3 gap-6">
              {(
                [
                  { name: 'xs', className: 'shadow-xs' },
                  { name: 'elevation', className: 'shadow-elevation' },
                  { name: 'popover', className: 'shadow-popover' },
                ] as const
              ).map((s) => (
                <div key={s.name} className="space-y-2 text-center">
                  <div className={cn('h-16 w-full rounded-lg bg-card', s.className)} />
                  <p className="text-xs text-muted-foreground">shadow-{s.name}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section id="buttons" title="Boutons" description="Variantes, tailles et états.">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Button>Default</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="link">Link</Button>
                <Button variant="destructive">Destructive</Button>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm">Small</Button>
                <Button size="default">Default</Button>
                <Button size="lg">Large</Button>
                <Button size="icon" aria-label="Paramètres">
                  <Settings />
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button disabled>Désactivé</Button>
                <Button
                  disabled={loading}
                  onClick={() => {
                    setLoading(true);
                    setTimeout(() => setLoading(false), 1500);
                  }}
                >
                  {loading && <Loader2 className="animate-spin" />}
                  {loading ? 'Chargement...' : 'Simuler un chargement'}
                </Button>
              </div>
            </div>
          </Section>

          <Section id="forms" title="Champs de formulaire" description="Input, Select, Checkbox, Radio, Switch.">
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ds-input">Nom complet</Label>
                <Input id="ds-input" placeholder="Ex. Ahmed Ben Ali" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ds-input-disabled">Champ désactivé</Label>
                <Input id="ds-input-disabled" disabled placeholder="Non modifiable" />
              </div>
              <div className="space-y-2">
                <Label>Catégorie de véhicule</Label>
                <Select defaultValue="berline">
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Catégories</SelectLabel>
                      <SelectItem value="citadine">Citadine</SelectItem>
                      <SelectItem value="berline">Berline</SelectItem>
                      <SelectItem value="suv">SUV</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <Label>Statut du client</Label>
                <RadioGroup defaultValue="actif" className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="actif" id="ds-radio-actif" />
                    <Label htmlFor="ds-radio-actif" className="font-normal">
                      Actif
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="liste-noire" id="ds-radio-blacklist" />
                    <Label htmlFor="ds-radio-blacklist" className="font-normal">
                      Liste noire
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="ds-checkbox" defaultChecked />
                <Label htmlFor="ds-checkbox" className="font-normal">
                  Envoyer une confirmation par email
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="ds-switch" defaultChecked />
                <Label htmlFor="ds-switch" className="font-normal">
                  Rappels automatiques
                </Label>
              </div>
            </div>
          </Section>

          <Section id="badges" title="Badges & alertes" description="Indicateurs de statut et messages contextuels.">
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
                <Badge>Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="success">Success</Badge>
                <Badge variant="warning">Warning</Badge>
                <Badge variant="destructive">Destructive</Badge>
                <Badge variant="outline">Outline</Badge>
              </div>
              <div className="space-y-3">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Information</AlertTitle>
                  <AlertDescription>Le contrat sera généré automatiquement au format PDF.</AlertDescription>
                </Alert>
                <Alert variant="success">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Succès</AlertTitle>
                  <AlertDescription>La location a été créée avec succès.</AlertDescription>
                </Alert>
                <Alert variant="warning">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Attention</AlertTitle>
                  <AlertDescription>Le permis de conduire expire dans 5 jours.</AlertDescription>
                </Alert>
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>Erreur</AlertTitle>
                  <AlertDescription>Impossible d'enregistrer les modifications.</AlertDescription>
                </Alert>
              </div>
            </div>
          </Section>

          <Section id="cards" title="Cartes" description="Conteneur de base utilisé pour les KPI et sections de contenu.">
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardDescription>Voitures disponibles</CardDescription>
                  <CardTitle className="text-3xl">24</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">sur 32 au total</CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardDescription>Locations actives</CardDescription>
                  <CardTitle className="text-3xl">8</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-success">+2 depuis hier</CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Client récent</CardTitle>
                  <CardDescription>Ajouté il y a 2 heures</CardDescription>
                </CardHeader>
                <CardContent className="text-sm">Sarra Meddeb — 22 rue de Marseille, Tunis</CardContent>
                <CardFooter>
                  <Button size="sm" variant="outline" className="w-full">
                    Voir le profil
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </Section>

          <Section
            id="list-controls"
            title="Recherche, filtres & pagination"
            description="Contrôles réutilisables pour les pages de liste — état géré ici pour la démonstration, aucune logique de recherche réelle."
          >
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <SearchBar value={search} onChange={setSearch} placeholder="Rechercher une voiture..." className="w-72" />
                <FilterBar
                  activeCount={statusFilter ? 1 : 0}
                  onClearAll={() => setStatusFilter(undefined)}
                >
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-44">
                      <SelectValue placeholder="Statut" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Disponible</SelectItem>
                      <SelectItem value="rented">Louée</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                    </SelectContent>
                  </Select>
                  {statusFilter && (
                    <Badge variant="secondary" className="gap-1">
                      {statusFilter === 'available' && 'Disponible'}
                      {statusFilter === 'rented' && 'Louée'}
                      {statusFilter === 'maintenance' && 'Maintenance'}
                    </Badge>
                  )}
                </FilterBar>
              </div>

              <Pagination page={page} pageCount={12} onPageChange={setPage} />
            </div>
          </Section>

          <Section id="table" title="Tableau" description="Table de données avec statuts et actions.">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Modèle</TableHead>
                  <TableHead>Immatriculation</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Tarif / jour</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockCars.map((car) => (
                  <TableRow key={car.id}>
                    <TableCell className="font-medium">{car.model}</TableCell>
                    <TableCell className="text-muted-foreground">{car.plate}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[car.status]}>{statusLabel[car.status]}</Badge>
                    </TableCell>
                    <TableCell>{car.rate}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Actions">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>Modifier</DropdownMenuItem>
                          <DropdownMenuItem>Voir l'historique</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive">Archiver</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Section>

          <Section id="tabs-accordion" title="Onglets & accordéon">
            <div className="grid gap-8 md:grid-cols-2">
              <Tabs defaultValue="details">
                <TabsList>
                  <TabsTrigger value="details">Détails</TabsTrigger>
                  <TabsTrigger value="history">Historique</TabsTrigger>
                  <TabsTrigger value="documents">Documents</TabsTrigger>
                </TabsList>
                <TabsContent value="details" className="text-sm text-muted-foreground">
                  Informations générales sur le véhicule.
                </TabsContent>
                <TabsContent value="history" className="text-sm text-muted-foreground">
                  Liste des locations précédentes.
                </TabsContent>
                <TabsContent value="documents" className="text-sm text-muted-foreground">
                  Carte grise, assurance, contrôle technique.
                </TabsContent>
              </Tabs>

              <Accordion type="single" collapsible>
                <AccordionItem value="item-1">
                  <AccordionTrigger>Quelles sont les conditions de location ?</AccordionTrigger>
                  <AccordionContent>
                    Le client doit fournir un permis de conduire valide et une pièce d'identité.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-2">
                  <AccordionTrigger>Comment est calculé le dépôt de garantie ?</AccordionTrigger>
                  <AccordionContent>Le dépôt dépend de la catégorie du véhicule loué.</AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </Section>

          <Section id="skeleton" title="États de chargement" description="Squelettes utilisés pendant le chargement des données.">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
          </Section>

          <Section id="overlays" title="Tooltip & popover">
            <div className="flex flex-wrap items-center gap-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Notifications">
                    <Bell className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Notifications</TooltipContent>
              </Tooltip>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline">
                    <Calendar className="h-4 w-4" />
                    Choisir une date
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 text-sm text-muted-foreground">
                  Le composant de sélection de date sera branché lors du module Locations.
                </PopoverContent>
              </Popover>
            </div>
          </Section>

          <Section id="dialogs" title="Modales & confirmation">
            <div className="flex flex-wrap items-center gap-3">
              <Dialog>
                <DialogTrigger asChild>
                  <Button>Ouvrir une modale</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nouvelle location</DialogTitle>
                    <DialogDescription>Formulaire de création — écran de démonstration.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2">
                    <Label htmlFor="ds-dialog-client">Client</Label>
                    <Input id="ds-dialog-client" placeholder="Rechercher un client" />
                  </div>
                  <DialogFooter>
                    <Button variant="outline">Annuler</Button>
                    <Button>Créer</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">Archiver la voiture</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmer l'archivage ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action peut être annulée plus tard depuis les archives.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction>Archiver</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline">Ouvrir un tiroir</Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Filtres</SheetTitle>
                    <SheetDescription>Utilisé pour la navigation mobile et les panneaux de filtres.</SheetDescription>
                  </SheetHeader>
                </SheetContent>
              </Sheet>
            </div>
          </Section>

          <Section id="menus" title="Menus" description="Menu déroulant et menu contextuel (clic droit).">
            <div className="flex flex-wrap items-center gap-6">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    Actions
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>Mon compte</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>Profil</DropdownMenuItem>
                  <DropdownMenuItem>Paramètres</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <ContextMenu>
                <ContextMenuTrigger className="flex h-20 w-56 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                  Clic droit ici
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem>Modifier</ContextMenuItem>
                  <ContextMenuItem>Dupliquer</ContextMenuItem>
                  <ContextMenuItem className="text-destructive">Supprimer</ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            </div>
          </Section>

          <Section
            id="command"
            title="Palette de commandes"
            description="Primitive de base (cmdk). La palette globale complète (Ctrl/Cmd+K) est disponible dans la barre supérieure de l'application."
          >
            <Command className="max-w-md rounded-lg border border-border">
              <CommandInput placeholder="Rechercher..." />
              <CommandList>
                <CommandEmpty>Aucun résultat.</CommandEmpty>
                <CommandGroup heading="Navigation">
                  <CommandItem>Tableau de bord</CommandItem>
                  <CommandItem>Voitures</CommandItem>
                  <CommandItem>Clients</CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </Section>

          <Section id="navigation" title="Breadcrumb & avatar">
            <div className="space-y-6">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink href="#">Tableau de bord</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink href="#">Voitures</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Renault Clio V</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>

              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback>
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <Avatar>
                  <AvatarFallback>AB</AvatarFallback>
                </Avatar>
              </div>
            </div>
          </Section>

          <Section id="toast" title="Notifications" description="Toasts globaux (sonner), déclenchés depuis n'importe quelle action.">
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => toast('Modifications enregistrées.')}>
                Default
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  toast.success('Location créée avec succès.', {
                    icon: <CheckCircle2 className="h-4 w-4" />,
                  })
                }
              >
                Succès
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  toast.warning('Le document expire bientôt.', {
                    icon: <AlertTriangle className="h-4 w-4" />,
                  })
                }
              >
                Avertissement
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  toast.error("Échec de l'enregistrement.", { icon: <XCircle className="h-4 w-4" /> })
                }
              >
                Erreur
              </Button>
            </div>
          </Section>

          <Section
            id="composites"
            title="Composants réutilisables"
            description="Blocs composites construits sur les primitives — utilisés dans toutes les pages métier."
          >
            <div className="space-y-8">
              <div>
                <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  PageHeader
                </p>
                <div className="rounded-lg border border-border p-4">
                  <PageHeader
                    title="Gestion des voitures"
                    description="24 voitures enregistrées dans le parc."
                    actions={<Button size="sm">Ajouter une voiture</Button>}
                  />
                </div>
              </div>

              <div>
                <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  KpiCard
                </p>
                <div className="grid gap-4 sm:grid-cols-3">
                  <KpiCard
                    label="Voitures disponibles"
                    value="24"
                    icon={CarFront}
                    trend={{ value: '+3', direction: 'up' }}
                    description="vs. mois dernier"
                  />
                  <KpiCard
                    label="Clients actifs"
                    value="128"
                    icon={Users}
                    trend={{ value: '-2', direction: 'down' }}
                    description="vs. mois dernier"
                  />
                  <KpiCard
                    label="Revenu du mois"
                    value="12 450 DT"
                    icon={Wallet}
                    trend={{ value: '0%', direction: 'neutral' }}
                    description="stable"
                  />
                </div>
              </div>

              <div>
                <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  ChartCard
                </p>
                <ChartCard
                  title="Revenu mensuel"
                  description="Aperçu du conteneur — graphiques réels au module Tableau de bord"
                  contentClassName="h-40"
                >
                  <div className="flex h-full items-end gap-2">
                    {[40, 65, 50, 80, 60, 90, 70].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t-sm bg-chart-1/70"
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                </ChartCard>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    EmptyState
                  </p>
                  <EmptyState
                    title="Aucune location trouvée"
                    description="Créez votre première location pour commencer."
                    action={<Button size="sm">Nouvelle location</Button>}
                  />
                </div>
                <div>
                  <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    LoadingState
                  </p>
                  <div className="rounded-xl border border-dashed border-border">
                    <LoadingState message="Chargement des locations..." />
                  </div>
                </div>
                <div>
                  <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    ErrorState
                  </p>
                  <ErrorState onRetry={() => toast('Nouvelle tentative...')} />
                </div>
              </div>

              <div>
                <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  ConfirmDialog
                </p>
                <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
                  Supprimer le client
                </Button>
                <ConfirmDialog
                  open={confirmOpen}
                  onOpenChange={setConfirmOpen}
                  title="Supprimer ce client ?"
                  description="Cette action archive le client. Il pourra être restauré depuis les archives."
                  confirmLabel="Supprimer"
                  variant="destructive"
                  onConfirm={async () => {
                    await new Promise((resolve) => setTimeout(resolve, 1200));
                    toast.success('Client archivé.');
                  }}
                />
              </div>
            </div>
          </Section>

          <Section id="misc" title="Divers" description="Separator, ScrollArea, Collapsible.">
            <div className="space-y-6">
              <div>
                <p className="text-sm">Section A</p>
                <Separator className="my-2" />
                <p className="text-sm">Section B</p>
              </div>

              <ScrollArea className="h-32 w-full rounded-lg border border-border p-4">
                <div className="space-y-2 text-sm text-muted-foreground">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <p key={i}>Ligne de contenu défilant {i + 1}</p>
                  ))}
                </div>
              </ScrollArea>

              <Collapsible className="w-full max-w-md">
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    Coordonnées supplémentaires
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-2 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <Mail className="h-4 w-4" /> contact@agence.tn
                  </p>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </Section>
        </main>
      </div>
    </div>
  );
}

export default DesignSystemPage;
