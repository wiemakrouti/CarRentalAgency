import type {
  CarCategory,
  CarStatus,
  CreateCarInput,
  FuelType,
  MANUALLY_SETTABLE_CAR_STATUSES,
  Transmission,
  UpdateCarInput,
} from '@car-rental/shared';
import { apiClient } from '@/lib/api-client';
import { buildQueryString } from '@/lib/query-string';

// Only status a manual change (edit form's earlier status field, quick-change
// menu, bulk action) may set — RENTED is exclusively set by the rental
// lifecycle. Mirrors the backend's MANUALLY_SETTABLE_CAR_STATUSES-restricted
// updateCarSchema/bulkCarStatusSchema.
export type ManualCarStatus = (typeof MANUALLY_SETTABLE_CAR_STATUSES)[number];

export type CarImage = {
  id: string;
  carId: string;
  url: string;
  publicId: string;
  isPrimary: boolean;
  createdAt: string;
};

export type Car = {
  id: string;
  licensePlate: string;
  vin: string | null;
  brand: string;
  model: string;
  year: number;
  color: string;
  category: CarCategory;
  transmission: Transmission;
  fuelType: FuelType;
  seats: number;
  mileage: number;
  dailyRate: string;
  status: CarStatus;
  purchaseDate: string | null;
  purchasePrice: string | null;
  insuranceExpiryDate: string | null;
  technicalInspectionExpiryDate: string | null;
  registrationExpiryDate: string | null;
  createdAt: string;
  updatedAt: string;
  images: CarImage[];
  // Set only while status is RENTED — the rental currently holding this car.
  activeRental: { plannedReturnDate: string } | null;
};

export type CarSortField =
  'brand' | 'licensePlate' | 'category' | 'status' | 'dailyRate' | 'year' | 'mileage' | 'createdAt';
export type SortOrder = 'asc' | 'desc';

export type CarListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
  status?: string;
  transmission?: string;
  fuelType?: string;
  minDailyRate?: number;
  maxDailyRate?: number;
  minYear?: number;
  maxYear?: number;
  minMileage?: number;
  maxMileage?: number;
  sortBy?: CarSortField;
  sortOrder?: SortOrder;
};

export type CarStats = {
  totalRentals: number;
  completedRentals: number;
  totalRevenue: number;
  lastRentalDate: string | null;
};

export type CarDeletable = {
  canDelete: boolean;
  reason: string | null;
};

export const carsApi = {
  list: (params: CarListParams) => apiClient.getPaginated<Car>(`/cars${buildQueryString(params)}`),
  getById: (id: string) => apiClient.get<Car>(`/cars/${id}`),
  getStats: (id: string) => apiClient.get<CarStats>(`/cars/${id}/stats`),
  checkDeletable: (id: string) => apiClient.get<CarDeletable>(`/cars/${id}/deletable`),
  create: (input: CreateCarInput) => apiClient.post<Car>('/cars', input),
  update: (id: string, input: UpdateCarInput) => apiClient.patch<Car>(`/cars/${id}`, input),
  delete: (id: string) => apiClient.delete<{ deleted: boolean }>(`/cars/${id}`),
  uploadImage: (id: string, file: File, isPrimary: boolean) => {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('isPrimary', String(isPrimary));
    return apiClient.postForm<CarImage>(`/cars/${id}/images`, formData);
  },
  deleteImage: (carId: string, imageId: string) =>
    apiClient.delete<{ deleted: boolean }>(`/cars/${carId}/images/${imageId}`),
  setPrimaryImage: (carId: string, imageId: string) =>
    apiClient.post<CarImage>(`/cars/${carId}/images/${imageId}/primary`),
  available: (pickupDate: string, returnDate: string) =>
    apiClient.get<Car[]>(`/cars/available?pickupDate=${pickupDate}&returnDate=${returnDate}`),
  exportCsv: (params: Omit<CarListParams, 'page' | 'pageSize'>) =>
    apiClient.download(`/cars/export${buildQueryString(params)}`),
  exportXlsx: (params: Omit<CarListParams, 'page' | 'pageSize'>) =>
    apiClient.download(`/cars/export/xlsx${buildQueryString(params)}`),
  updateStatus: (id: string, status: ManualCarStatus) =>
    apiClient.patch<Car>(`/cars/${id}`, { status }),
};
