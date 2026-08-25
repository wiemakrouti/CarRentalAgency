import { CarFront, ChevronRight, Cog, Fuel, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { Car } from '../api/cars.api';
import { CarRowActions } from './car-row-actions';
import { CarStatusBadge } from './car-status-badge';
import { CarExpiryAlerts } from './car-expiry-alerts';
import { CAR_CATEGORY_LABELS, FUEL_TYPE_LABELS, TRANSMISSION_LABELS } from '../lib/car-labels';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-TN');
}

type CarGridProps = {
  cars: Car[];
  onEdit: (car: Car) => void;
  onViewDetails: (car: Car) => void;
  onOpenCalendar: (car: Car) => void;
};

export function CarGrid({ cars, onEdit, onViewDetails, onOpenCalendar }: CarGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {cars.map((car) => {
        const primary = car.images.find((img) => img.isPrimary) ?? car.images[0];
        const outOfService = car.status === 'OUT_OF_SERVICE';
        return (
          <Card
            key={car.id}
            className={
              'group cursor-pointer overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-popover' +
              (outOfService ? ' opacity-70' : '')
            }
            onClick={() => onViewDetails(car)}
          >
            <div className="relative h-36 w-full overflow-hidden">
              {primary ? (
                <img src={primary.url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary-100 to-primary-50">
                  <CarFront className="h-16 w-16 text-primary-200" strokeWidth={1.3} />
                </div>
              )}
              <div className="absolute left-2 top-2" onClick={(e) => e.stopPropagation()}>
                <CarStatusBadge car={car} />
              </div>
              <div className="absolute right-2 top-2" onClick={(e) => e.stopPropagation()}>
                <CarRowActions
                  car={car}
                  onEdit={onEdit}
                  onViewDetails={onViewDetails}
                  onOpenCalendar={onOpenCalendar}
                />
              </div>
            </div>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold leading-tight">
                    {car.brand} {car.model}
                  </p>
                  <p className="text-xs text-muted-foreground">{car.licensePlate}</p>
                </div>
                <span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-secondary-foreground">
                  {CAR_CATEGORY_LABELS[car.category]}
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Cog className="h-3.5 w-3.5" />
                  {TRANSMISSION_LABELS[car.transmission]}
                </span>
                <span className="flex items-center gap-1">
                  <Fuel className="h-3.5 w-3.5" />
                  {FUEL_TYPE_LABELS[car.fuelType]}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {car.seats} places
                </span>
              </div>

              {car.activeRental && (
                <p className="text-xs text-muted-foreground">
                  Retour prévu le {formatDate(car.activeRental.plannedReturnDate)}
                </p>
              )}

              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="text-base font-bold text-foreground">
                  {Number(car.dailyRate).toLocaleString('fr-TN')}
                  <span className="text-xs font-medium text-muted-foreground"> DT/jour</span>
                </span>
                <div className="flex items-center gap-2">
                  <CarExpiryAlerts car={car} />
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
