import type { LucideIcon } from 'lucide-react';
import {
  Ban,
  CalendarPlus,
  CarFront,
  ClipboardList,
  HandCoins,
  KeyRound,
  LogIn,
  Pencil,
  Receipt,
  Settings,
  Trash2,
  Undo2,
  UserCog,
  Users,
} from 'lucide-react';
import type { ApprovalType, ExpenseCategory, PaymentMethod, PaymentType } from '@car-rental/shared';

import { EXPENSE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_TYPE_LABELS } from '@/features/finances/lib/finance-labels';

import { describeApproval } from '@/features/approvals/lib/describe-approval';

import type { ActivityEntry } from '../api/activity.api';

export type Tone = 'default' | 'success' | 'warning' | 'destructive';

export type ActivityChange = { label: string; before: string; after: string };

export type DescribedActivity = {
  // What happened, without the author ("a clôturé la location LOC-…") — the
  // journal row puts the author's name in front.
  text: string;
  detail?: string;
  icon: LucideIcon;
  tone: Tone;
  link?: string;
  changes: ActivityChange[];
};

type Format = { money: (amount: number) => string; userName: (id: string | null) => string | null };
type Snap = Record<string, unknown> | null;

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function date(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('fr-TN', { day: 'numeric', month: 'short' });
}

function carName(s: Snap): string {
  return [str(s?.brand), str(s?.model), str(s?.licensePlate) && `(${str(s?.licensePlate)})`].filter(Boolean).join(' ') || 'une voiture';
}

function clientName(s: Snap): string {
  return [str(s?.firstName), str(s?.lastName)].filter(Boolean).join(' ') || 'un client';
}

const rentalRef = (s: Snap) => str(s?.rentalNumber) ?? '';

// Field labels for the before → after details of an edit. Fields not listed
// (ids, timestamps, nested records) aren't shown.
const FIELD_LABELS: Record<string, string> = {
  dailyRate: 'Tarif / jour',
  status: 'Statut',
  amount: 'Montant',
  method: 'Moyen',
  type: 'Type',
  mileage: 'Kilométrage',
  plannedReturnDate: 'Retour prévu',
  firstName: 'Prénom',
  lastName: 'Nom',
  phone: 'Téléphone',
  email: 'Email',
  address: 'Adresse',
  city: 'Ville',
  brand: 'Marque',
  model: 'Modèle',
  licensePlate: 'Immatriculation',
  color: 'Couleur',
  category: 'Catégorie',
  description: 'Description',
  date: 'Date',
  notes: 'Notes',
  agencyName: "Nom de l'agence",
  defaultDepositAmount: 'Caution par défaut',
  largeExpenseThreshold: "Seuil d'alerte des dépenses",
  reminderWindowDays: 'Fenêtre des rappels',
  fullName: 'Nom',
  insuranceExpiryDate: 'Fin d’assurance',
  technicalInspectionExpiryDate: 'Contrôle technique',
  registrationExpiryDate: 'Carte grise',
  drivingLicenseExpiry: 'Fin du permis',
};

function display(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return date(v) ?? v;
  if (typeof v === 'object') return '…';
  return String(v);
}

function diff(before: Snap, after: Snap): ActivityChange[] {
  if (!before || !after) return [];
  return Object.keys(FIELD_LABELS)
    .filter((key) => key in after && String(before[key] ?? '') !== String(after[key] ?? ''))
    .slice(0, 8)
    .map((key) => ({ label: FIELD_LABELS[key]!, before: display(before[key]), after: display(after[key]) }));
}

function entityLink(entry: Pick<ActivityEntry, 'entityType' | 'entityId'>, after: Snap): string | undefined {
  const id = entry.entityId;
  switch (entry.entityType) {
    case 'Rental':
      return id ? `/rentals?openId=${encodeURIComponent(id)}` : '/rentals';
    case 'Car':
      return id ? `/cars?openId=${encodeURIComponent(id)}` : '/cars';
    case 'Client':
      return id ? `/clients?openId=${encodeURIComponent(id)}` : '/clients';
    case 'Payment': {
      const rentalId = str(after?.rentalId);
      return rentalId ? `/rentals?openId=${encodeURIComponent(rentalId)}` : '/finances';
    }
    case 'Expense':
      return '/finances';
    case 'User':
      return '/team';
    case 'Setting':
      return '/settings';
    default:
      return undefined;
  }
}

function paymentText(s: Snap, f: Format): string {
  const amount = num(s?.amount);
  const type = str(s?.type) as PaymentType | null;
  const method = str(s?.method) as PaymentMethod | null;
  const what = type ? PAYMENT_TYPE_LABELS[type]?.toLowerCase() : 'paiement';
  return [amount !== null ? f.money(amount) : null, what, method ? `· ${PAYMENT_METHOD_LABELS[method]}` : null]
    .filter(Boolean)
    .join(' ');
}

// One audit entry as a French sentence for the activity journal.
export function describeActivity(entry: ActivityEntry, f: Format): DescribedActivity {
  const before = entry.before;
  const after = entry.after;
  const snap = after ?? before;
  const link = entityLink(entry, snap);
  const base = { link, changes: [] as ActivityChange[] };

  switch (`${entry.action}:${entry.entityType ?? ''}`) {
    // Rentals
    case 'CREATE:Rental': {
      const rate = num(after?.dailyRate);
      const catalog = num(after?.catalogDailyRate);
      const negotiated = rate !== null && catalog !== null && catalog > 0 && rate < catalog;
      return {
        ...base,
        text: `a créé la location ${rentalRef(after)}`,
        detail: negotiated ? `Tarif négocié ${f.money(rate)} / jour au lieu de ${f.money(catalog)} (−${Math.round(((catalog - rate) / catalog) * 100)} %)` : undefined,
        icon: ClipboardList,
        tone: negotiated ? 'warning' : 'default',
      };
    }
    case 'RENTAL_ACTIVATE:Rental':
      return { ...base, text: `a remis les clés — location ${rentalRef(after)}`, icon: KeyRound, tone: 'success' };
    case 'RENTAL_RETURN:Rental':
      return { ...base, text: `a clôturé la location ${rentalRef(after)}`, icon: Undo2, tone: 'success' };
    case 'RENTAL_EXTEND:Rental':
      return {
        ...base,
        text: `a prolongé la location ${rentalRef(after)}`,
        detail: date(after?.plannedReturnDate) ? `Nouveau retour le ${date(after?.plannedReturnDate)}` : undefined,
        icon: CalendarPlus,
        tone: 'default',
      };
    case 'RENTAL_CANCEL:Rental':
      return {
        ...base,
        text: `a annulé la location ${rentalRef(after)}`,
        detail: str(after?.cancelledReason) ? `Motif : ${str(after?.cancelledReason)}` : undefined,
        icon: Ban,
        tone: 'destructive',
      };
    case 'RENTAL_AUTO_CANCEL:Rental':
      return { ...base, text: `Réservation ${rentalRef(after)} annulée automatiquement`, detail: 'Jamais récupérée avant la fin de la période réservée.', icon: Ban, tone: 'default' };
    case 'RENTAL_REVERT_ACTIVATION:Rental':
      return { ...base, text: `Correction de la location ${rentalRef(after)}`, icon: Pencil, tone: 'default' };

    // Payments
    case 'CREATE:Payment':
      return str(after?.type) === 'DEPOSIT_REFUND'
        ? { ...base, text: `a remboursé une caution de ${f.money(num(after?.amount) ?? 0)}`, icon: HandCoins, tone: 'warning' }
        : { ...base, text: `a encaissé ${paymentText(after, f)}`, icon: HandCoins, tone: 'success' };
    case 'UPDATE:Payment':
      return { ...base, text: 'a modifié un paiement', icon: Pencil, tone: 'warning', changes: diff(before, after) };
    case 'DELETE:Payment':
      return { ...base, text: `a archivé un paiement (${paymentText(before, f)})`, icon: Trash2, tone: 'destructive' };
    case 'RESTORE:Payment':
      return { ...base, text: 'a restauré un paiement archivé', icon: Undo2, tone: 'default' };
    case 'PAYMENT_ATTACHMENT_ADD:Payment':
      return { ...base, text: 'a ajouté une pièce jointe à un paiement', icon: Receipt, tone: 'default' };
    case 'PAYMENT_ATTACHMENT_REMOVE:Payment':
      return { ...base, text: "a retiré une pièce jointe d'un paiement", icon: Trash2, tone: 'warning' };

    // Expenses
    case 'CREATE:Expense': {
      const category = str(after?.category) as ExpenseCategory | null;
      return {
        ...base,
        text: `a enregistré une dépense de ${f.money(num(after?.amount) ?? 0)}`,
        detail: [category ? EXPENSE_CATEGORY_LABELS[category] : null, str(after?.description)].filter(Boolean).join(' · ') || undefined,
        icon: Receipt,
        tone: 'default',
      };
    }
    case 'UPDATE:Expense':
      return { ...base, text: 'a modifié une dépense', icon: Pencil, tone: 'default', changes: diff(before, after) };
    case 'DELETE:Expense':
      return { ...base, text: `a archivé une dépense de ${f.money(num(before?.amount) ?? 0)}`, icon: Trash2, tone: 'destructive' };
    case 'RESTORE:Expense':
      return { ...base, text: 'a restauré une dépense archivée', icon: Undo2, tone: 'default' };

    // Clients
    case 'CREATE:Client':
      return { ...base, text: `a ajouté le client ${clientName(after)}`, icon: Users, tone: 'default' };
    case 'UPDATE:Client':
      return { ...base, text: `a modifié le client ${clientName(after)}`, icon: Pencil, tone: 'default', changes: diff(before, after) };
    case 'CLIENT_HARD_DELETE:Client':
      return { ...base, link: undefined, text: `a supprimé le client ${clientName(before)}`, icon: Trash2, tone: 'destructive' };
    case 'CLIENT_DOCUMENT_ADD:Client':
      return { ...base, text: "a ajouté un document à la fiche d'un client", icon: Users, tone: 'default' };
    case 'CLIENT_DOCUMENT_REMOVE:Client':
      return { ...base, text: "a retiré un document de la fiche d'un client", icon: Trash2, tone: 'warning' };

    // Cars
    case 'CREATE:Car':
      return { ...base, text: `a ajouté la voiture ${carName(after)}`, icon: CarFront, tone: 'default' };
    case 'UPDATE:Car': {
      const priceChanged = num(before?.dailyRate) !== null && num(before?.dailyRate) !== num(after?.dailyRate) && 'dailyRate' in (after ?? {});
      return {
        ...base,
        text: str(after?.brand) ? `a modifié la voiture ${carName(after)}` : 'a changé le statut d’une voiture',
        icon: priceChanged ? Pencil : CarFront,
        tone: priceChanged ? 'warning' : 'default',
        changes: diff(before, after),
      };
    }
    case 'CAR_HARD_DELETE:Car':
      return { ...base, link: undefined, text: `a supprimé la voiture ${carName(before)}`, icon: Trash2, tone: 'destructive' };
    case 'CAR_IMAGE_ADD:Car':
    case 'CAR_IMAGE_REMOVE:Car':
    case 'CAR_IMAGE_SET_PRIMARY:Car':
      return { ...base, text: 'a mis à jour les photos d’une voiture', icon: CarFront, tone: 'default' };

    // Settings & team
    case 'SETTINGS_UPDATE:Setting':
      return { ...base, text: "a modifié les paramètres de l'agence", icon: Settings, tone: 'default', changes: diff(before, after) };
    case 'SETTINGS_LOGO_UPDATE:Setting':
      return { ...base, text: "a changé le logo de l'agence", icon: Settings, tone: 'default' };
    case 'USER_CREATE:User':
      return { ...base, text: `a créé le compte de ${str(after?.fullName) ?? 'un employé'}`, icon: UserCog, tone: 'default' };
    case 'USER_UPDATE:User':
      return { ...base, text: `a modifié le compte de ${str(after?.fullName) ?? 'un employé'}`, icon: UserCog, tone: 'default', changes: diff(before, after) };
    case 'USER_DEACTIVATE:User':
      return { ...base, text: `a désactivé le compte de ${f.userName(entry.entityId) ?? 'un employé'}`, icon: UserCog, tone: 'destructive' };
    case 'USER_REACTIVATE:User':
      return { ...base, text: `a réactivé le compte de ${f.userName(entry.entityId) ?? 'un employé'}`, icon: UserCog, tone: 'default' };
    case 'USER_PASSWORD_RESET:User':
      return { ...base, text: `a réinitialisé le mot de passe de ${f.userName(entry.entityId) ?? 'un employé'}`, icon: KeyRound, tone: 'default' };
    // Requests that waited for the director
    case 'APPROVAL_REQUEST:ApprovalRequest':
    case 'APPROVAL_APPROVE:ApprovalRequest':
    case 'APPROVAL_REJECT:ApprovalRequest':
    case 'APPROVAL_WITHDRAW:ApprovalRequest': {
      const approval = describeApproval(after?.type as ApprovalType, (after?.summary ?? {}) as Record<string, unknown>, f.money);
      const requester = str(after?.requestedBy) ?? 'un employé';
      const TEXT: Record<string, { text: string; tone: Tone }> = {
        APPROVAL_REQUEST: { text: 'a demandé une validation', tone: 'warning' },
        APPROVAL_APPROVE: { text: `a validé la demande de ${requester}`, tone: 'success' },
        APPROVAL_REJECT: { text: `a refusé la demande de ${requester}`, tone: 'destructive' },
        APPROVAL_WITHDRAW: { text: 'a retiré sa demande', tone: 'default' },
      };
      const { text, tone } = TEXT[entry.action]!;
      return {
        ...base,
        link: undefined,
        text: `${text} : ${approval.title}`,
        detail: approval.detail || undefined,
        icon: approval.icon,
        tone,
      };
    }
    case 'CREATE:User':
      return { ...base, link: undefined, text: "a créé l'agence", icon: UserCog, tone: 'default' };
  }

  // Account actions (no entity).
  const ACCOUNT: Record<string, string> = {
    LOGIN: "s'est connecté",
    LOGOUT: "s'est déconnecté",
    PASSWORD_CHANGE: 'a changé son mot de passe',
    PASSWORD_RESET: 'a réinitialisé son mot de passe',
    PROFILE_UPDATE: 'a modifié son profil',
    EMAIL_VERIFY: 'a vérifié son adresse email',
    SESSION_REVOKE: 'a fermé une session',
    SESSIONS_REVOKE_OTHERS: 'a fermé ses autres sessions',
  };
  const account = ACCOUNT[entry.action];
  if (account) return { ...base, link: undefined, text: account, icon: LogIn, tone: 'default' };

  return { ...base, text: `${entry.action.toLowerCase()} ${entry.entityType ?? ''}`.trim(), icon: Pencil, tone: 'default' };
}
