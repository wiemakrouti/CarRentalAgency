import { ImageOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { Car } from '../api/cars.api';
import { CarRowActions } from './car-row-actions';
import { CarExpiryAlerts } from './car-expiry-alerts';
import { CAR_STATUS_BADGE_VARIANT, CAR_STATUS_LABELS } from '../lib/car-labels';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-TN');
}

type CarGridProps = {
  cars: Car[];
  onEdit: (car: Car) => void;
  onManageImages: (car: Car) => void;
  onViewDetails: (car: Car) => void;
  onOpenCalendar: (car: Car) => void;
};

export function CarGrid({
  cars,
  onEdit,
  onManageImages,
  onViewDetails,
  onOpenCalendar,
}: CarGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {cars.map((car) => {
        const primary = car.images.find((img) => img.isPrimary) ?? car.images[0];
        return (
          <Card
            key={car.id}
            className="cursor-pointer overflow-hidden transition-shadow hover:shadow-md"
            onClick={() => onViewDetails(car)}
          >
            <div className="relative h-40 w-full bg-muted">
              {primary ? (
                <img src={primary.url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <ImageOff className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="absolute right-2 top-2" onClick={(e) => e.stopPropagation()}>
                <CarRowActions
                  car={car}
                  onEdit={onEdit}
                  onManageImages={onManageImages}
                  onViewDetails={onViewDetails}
                  onOpenCalendar={onOpenCalendar}
                />
              </div>
            </div>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold leading-tight">
                    {car.brand} {car.model}
                  </p>
                  <p className="text-xs text-muted-foreground">{car.licensePlate}</p>
                </div>
                <Badge variant={CAR_STATUS_BADGE_VARIANT[car.status]}>
                  {CAR_STATUS_LABELS[car.status]}
                </Badge>
              </div>

              {car.activeRental && (
                <p className="text-xs text-muted-foreground">
                  Retour prévu le {formatDate(car.activeRental.plannedReturnDate)}
                </p>
              )}

              <div className="flex items-center justify-between pt-1">
                <span className="text-sm font-medium">
                  {Number(car.dailyRate).toLocaleString('fr-TN')} DT
                  <span className="text-muted-foreground"> /jour</span>
                </span>
                <CarExpiryAlerts car={car} />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
