import type { CarCategory, CarStatus, CreateCarInput, FuelType, Transmission, UpdateCarInput } from '@car-rental/shared';
import { apiClient } from '@/lib/api-client';
import { buildQueryString } from '@/lib/query-string';

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
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  images: CarImage[];
};

export type CarListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
  status?: string;
  transmission?: string;
  fuelType?: string;
  includeArchived?: boolean;
};

export const carsApi = {
  list: (params: CarListParams) => apiClient.getPaginated<Car>(`/cars${buildQueryString(params)}`),
  getById: (id: string) => apiClient.get<Car>(`/cars/${id}`),
  create: (input: CreateCarInput) => apiClient.post<Car>('/cars', input),
  update: (id: string, input: UpdateCarInput) => apiClient.patch<Car>(`/cars/${id}`, input),
  archive: (id: string) => apiClient.delete<Car>(`/cars/${id}`),
  restore: (id: string) => apiClient.post<Car>(`/cars/${id}/restore`),
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
};
