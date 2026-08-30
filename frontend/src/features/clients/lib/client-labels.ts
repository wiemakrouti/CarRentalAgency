import type { ClientDocumentType } from '@car-rental/shared';

export const CLIENT_DOCUMENT_TYPE_LABELS: Record<ClientDocumentType, string> = {
  ID_CARD: "Carte d'identité",
  DRIVING_LICENSE: 'Permis de conduire',
  PASSPORT: 'Passeport',
  OTHER: 'Autre',
};

// `nationality` is a free-text column in the DB (no enum/migration needed to
// extend this list) — this curated list just constrains the form's picker to
// the nationalities this agency's clientele actually needs, with a fallback
// for anything else instead of an open text field.
export const CLIENT_NATIONALITIES = [
  'Tunisienne',
  'Algérienne',
  'Libyenne',
  'Marocaine',
  'Mauritanienne',
  'Française',
  'Italienne',
  'Allemande',
  'Belge',
  'Britannique',
  'Espagnole',
  'Suisse',
  'Canadienne',
  'Américaine',
  'Autre',
] as const;

export const DEFAULT_CLIENT_NATIONALITY = 'Tunisienne';
