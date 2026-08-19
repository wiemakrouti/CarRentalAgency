import { apiClient } from '@/lib/api-client';

export type ReminderType =
  | 'RENTAL_RETURN_UPCOMING'
  | 'RENTAL_OVERDUE'
  | 'MAINTENANCE_DUE'
  | 'DRIVING_LICENSE_EXPIRING'
  | 'CAR_INSURANCE_EXPIRING'
  | 'CAR_TECHNICAL_INSPECTION_EXPIRING'
  | 'CAR_REGISTRATION_EXPIRING';

export type ReminderEntityType = 'Rental' | 'MaintenanceRecord' | 'Client' | 'Car';

export type Reminder = {
  type: ReminderType;
  entityType: ReminderEntityType;
  entityId: string;
  dueDate: string;
  overdue: boolean;
  label: string;
};

export const notificationsApi = {
  getReminders: (withinDays = 7) =>
    apiClient.get<Reminder[]>(`/reminders?withinDays=${withinDays}`),
};
