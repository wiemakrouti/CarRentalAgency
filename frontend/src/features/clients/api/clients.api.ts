import type { ClientDocumentType, CreateClientInput, UpdateClientInput } from '@car-rental/shared';
import { apiClient } from '@/lib/api-client';
import { buildQueryString } from '@/lib/query-string';

export type ClientDocument = {
  id: string;
  clientId: string;
  type: ClientDocumentType;
  url: string;
  publicId: string;
  expiryDate: string | null;
  createdAt: string;
};

export type Client = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  address: string | null;
  city: string | null;
  nationalIdNumber: string | null;
  drivingLicenseNumber: string;
  drivingLicenseExpiry: string | null;
  dateOfBirth: string | null;
  blacklisted: boolean;
  notes: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  documents: ClientDocument[];
};

export type ClientListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  blacklisted?: boolean;
  includeArchived?: boolean;
};

export const clientsApi = {
  list: (params: ClientListParams) => apiClient.getPaginated<Client>(`/clients${buildQueryString(params)}`),
  getById: (id: string) => apiClient.get<Client>(`/clients/${id}`),
  create: (input: CreateClientInput) => apiClient.post<Client>('/clients', input),
  update: (id: string, input: UpdateClientInput) => apiClient.patch<Client>(`/clients/${id}`, input),
  archive: (id: string) => apiClient.delete<Client>(`/clients/${id}`),
  restore: (id: string) => apiClient.post<Client>(`/clients/${id}/restore`),
  uploadDocument: (id: string, file: File, type: ClientDocumentType, expiryDate?: string) => {
    const formData = new FormData();
    formData.append('document', file);
    formData.append('type', type);
    if (expiryDate) formData.append('expiryDate', expiryDate);
    return apiClient.postForm<ClientDocument>(`/clients/${id}/documents`, formData);
  },
  deleteDocument: (clientId: string, documentId: string) =>
    apiClient.delete<{ deleted: boolean }>(`/clients/${clientId}/documents/${documentId}`),
};
