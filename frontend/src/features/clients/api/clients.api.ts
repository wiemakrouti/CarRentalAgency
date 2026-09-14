import type { ClientDocumentType, CreateClientInput, UpdateClientInput } from '@car-rental/shared';
import { apiClient } from '@/lib/api-client';
import { buildQueryString } from '@/lib/query-string';

export type ClientDocument = {
  id: string;
  clientId: string;
  type: ClientDocumentType;
  url: string;
  publicId: string;
  createdAt: string;
};

export type Client = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  nationality: string | null;
  address: string | null;
  city: string | null;
  nationalIdNumber: string | null;
  drivingLicenseNumber: string;
  drivingLicenseExpiry: string | null;
  dateOfBirth: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  documents: ClientDocument[];
  // Only populated by GET /clients (list) — computed for the whole page in
  // one query there. undefined on a single-client fetch (getById/create/
  // update), which doesn't compute it.
  reliabilityRate?: number | null;
  completedRentals?: number;
  cancelledRentals?: number;
};

export type ClientSortField = 'lastName' | 'city' | 'createdAt' | 'drivingLicenseExpiry';
export type SortOrder = 'asc' | 'desc';
export type ClientLicenseStatus = 'expired' | 'expiring' | 'ok' | 'not_set';

export type ClientListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  city?: string;
  licenseStatus?: ClientLicenseStatus;
  // Date-only strings (YYYY-MM-DD) — backs the Dashboard's "+X ce mois-ci".
  createdFrom?: string;
  createdTo?: string;
  sortBy?: ClientSortField;
  sortOrder?: SortOrder;
};

export type ClientStats = {
  totalRentals: number;
  completedRentals: number;
  cancelledRentals: number;
  totalRevenue: number;
  lastRentalDate: string | null;
  onTimeReturnRate: number | null;
  // Share of resolved reservations (Terminée + Annulée) that were actually
  // honored — null when the client has no resolved rental yet.
  reliabilityRate: number | null;
};

export type ClientPhoneMatch = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
};

export type ClientDeletable = {
  canDelete: boolean;
  reason: string | null;
};

export const clientsApi = {
  list: (params: ClientListParams) => apiClient.getPaginated<Client>(`/clients${buildQueryString(params)}`),
  getById: (id: string) => apiClient.get<Client>(`/clients/${id}`),
  getStats: (id: string) => apiClient.get<ClientStats>(`/clients/${id}/stats`),
  checkDeletable: (id: string) => apiClient.get<ClientDeletable>(`/clients/${id}/deletable`),
  checkPhoneDuplicate: (phone: string, excludeId?: string) =>
    apiClient.get<ClientPhoneMatch[]>(`/clients/check-phone${buildQueryString({ phone, excludeId })}`),
  create: (input: CreateClientInput) => apiClient.post<Client>('/clients', input),
  update: (id: string, input: UpdateClientInput) => apiClient.patch<Client>(`/clients/${id}`, input),
  delete: (id: string) => apiClient.delete<{ deleted: boolean }>(`/clients/${id}`),
  exportCsv: (params: Omit<ClientListParams, 'page' | 'pageSize'>) =>
    apiClient.download(`/clients/export${buildQueryString(params)}`),
  exportXlsx: (params: Omit<ClientListParams, 'page' | 'pageSize'>) =>
    apiClient.download(`/clients/export/xlsx${buildQueryString(params)}`),
  uploadDocument: (id: string, file: File, type: ClientDocumentType) => {
    const formData = new FormData();
    formData.append('document', file);
    formData.append('type', type);
    return apiClient.postForm<ClientDocument>(`/clients/${id}/documents`, formData);
  },
  deleteDocument: (clientId: string, documentId: string) =>
    apiClient.delete<{ deleted: boolean }>(`/clients/${clientId}/documents/${documentId}`),
};
