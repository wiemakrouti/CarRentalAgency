import type { CreateRentalInput, RentalStatus } from '@car-rental/shared';
import type { Car } from '@/features/cars/api/cars.api';
import type { Client } from '@/features/clients/api/clients.api';
import { apiClient } from '@/lib/api-client';
import { buildQueryString } from '@/lib/query-string';

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
};

export type RentalListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  carId?: string;
  clientId?: string;
  includeArchived?: boolean;
};

export const rentalsApi = {
  list: (params: RentalListParams) => apiClient.getPaginated<Rental>(`/rentals${buildQueryString(params)}`),
  getById: (id: string) => apiClient.get<Rental>(`/rentals/${id}`),
  create: (input: CreateRentalInput) => apiClient.post<Rental>('/rentals', input),
};
