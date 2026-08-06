import type { ClientDocumentType } from '@car-rental/shared';

export const CLIENT_DOCUMENT_TYPE_LABELS: Record<ClientDocumentType, string> = {
  ID_CARD: "Carte d'identité",
  DRIVING_LICENSE: 'Permis de conduire',
  PASSPORT: 'Passeport',
  OTHER: 'Autre',
};
