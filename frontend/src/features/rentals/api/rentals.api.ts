import type {
  ActivateRentalInput,
  CancelRentalInput,
  CreateRentalInput,
  ExtendRentalInput,
  RentalStatus,
  ReturnRentalInput,
} from '@car-rental/shared';
import type { Car } from '@/features/cars/api/cars.api';
import type { Client } from '@/features/clients/api/clients.api';
import type { Payment } from '@/features/finances/api/finances.api';
import { apiClient } from '@/lib/api-client';
import { buildQueryString } from '@/lib/query-string';

export type RentalExtension = {
  id: string;
  rentalId: string;
  previousReturnDate: string;
  newReturnDate: string;
  additionalAmount: string;
  createdAt: string;
};

export type Rental = {
  id: string;
  rentalNumber: string;
  carId: string;
  clientId: string;
  pickupDate: string;
  plannedReturnDate: string;
  actualReturnDate: string | null;
  dailyRate: string;
  totalAmount: string;
  depositAmount: string;
  depositReturned: boolean;
  mileageAtPickup: number | null;
  mileageAtReturn: number | null;
  fuelLevelAtPickup: string | null;
  fuelLevelAtReturn: string | null;
  status: RentalStatus;
  cancelledReason: string | null;
  notes: string | null;
  createdByUserId: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  car: Car;
  client: Client;
  extensions: RentalExtension[];
  payments: Payment[];
};

// Backing the Rentals page's KPI header — four independent counts, each
// mirroring a distinction the notification bell already draws (ACTIVE vs.
// overdue-return, RESERVED vs. overdue-pickup).
export type RentalSummary = {
  active: number;
  overdueReturn: number;
  overduePickup: number;
  upcomingReservations: number;
};

// Dashboard's occupancy heatmap — one row per calendar day in the
// requested range, `count` being how many cars were actually out that day.
export type RentalOccupancyDay = {
  date: string;
  count: number;
};

export type RentalListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  carId?: string;
  clientId?: string;
  includeArchived?: boolean;
  // Narrows RESERVED further than `status` alone can — see the backend
  // validator's own comment. Set by the Rentals KPI header's "Départs en
  // retard" (true) / "Réservations à venir" (false) cards.
  pickupOverdue?: boolean;
  // Date-only strings (YYYY-MM-DD) — backs the Dashboard's status-pipeline
  // gauge, one count-only call per status scoped to a pickupDate window.
  pickupFrom?: string;
  pickupTo?: string;
};

export const rentalsApi = {
  list: (params: RentalListParams) => apiClient.getPaginated<Rental>(`/rentals${buildQueryString(params)}`),
  getSummary: () => apiClient.get<RentalSummary>('/rentals/summary'),
  getOccupancy: (from: string, to: string) =>
    apiClient.get<RentalOccupancyDay[]>(`/rentals/occupancy${buildQueryString({ from, to })}`),
  getById: (id: string) => apiClient.get<Rental>(`/rentals/${id}`),
  create: (input: CreateRentalInput) => apiClient.post<Rental>('/rentals', input),
  activate: (id: string, input: ActivateRentalInput) => apiClient.post<Rental>(`/rentals/${id}/activate`, input),
  returnRental: (id: string, input: ReturnRentalInput) => apiClient.post<Rental>(`/rentals/${id}/return`, input),
  extend: (id: string, input: ExtendRentalInput) => apiClient.post<Rental>(`/rentals/${id}/extend`, input),
  cancel: (id: string, input: CancelRentalInput) => apiClient.post<Rental>(`/rentals/${id}/cancel`, input),
};
