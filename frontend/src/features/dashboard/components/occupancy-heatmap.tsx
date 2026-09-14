import { Fragment } from 'react';
import { AlertTriangle } from 'lucide-react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { RentalOccupancyDay } from '@/features/rentals/api/rentals.api';

type OccupancyHeatmapProps = {
  days: RentalOccupancyDay[];
  totalCars: number;
};

const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

// 'YYYY-MM-DD' -> local Date. Never `new Date(dateString)` for a date-only
// string: that parses as UTC midnight, which in any timezone ahead of UTC
// reads back as the previous local day (the same bug class the backend's
// formatDateOnly and the frontend's own toDateParam both guard against).
function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year!, month! - 1, day!);
}

function formatDayLabel(date: Date): string {
  return `${date.getDate()} ${MONTH_LABELS[date.getMonth()]}`;
}

// Intensity bucket relative to the busiest day actually in range, not to the
// full fleet size: a small agency rarely (if ever) has every car out at
// once, so bucketing against `totalCars` left nearly every day in the
// lightest bucket and the heatmap read as flat. Relative-to-range instead
// highlights genuinely busier/quieter stretches regardless of fleet size —
// the same convention GitHub's own contribution heatmap uses.
function bucketFor(count: number, maxCount: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (maxCount <= 0) return 0;
  const ratio = count / maxCount;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

const BUCKET_CLASSNAME: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'bg-muted',
  1: 'bg-primary-100 dark:bg-primary/20',
  2: 'bg-primary-300 dark:bg-primary/45',
  3: 'bg-primary-500 dark:bg-primary/75',
  4: 'bg-primary-800 dark:bg-primary',
};

// Groups the flat, oldest-first day list into Monday-start week columns,
// padding the first (possibly partial) week with nulls so every column
// lines up on the same weekday row — the calendar-heatmap layout this
// widget is modeled on (GitHub's contribution graph) reads by column-per-
// week, row-per-weekday.
function buildWeeks(days: RentalOccupancyDay[]): (RentalOccupancyDay | null)[][] {
  if (days.length === 0) return [];
  const firstWeekday = (parseDateOnly(days[0]!.date).getDay() + 6) % 7; // Mon=0..Sun=6
  const padded: (RentalOccupancyDay | null)[] = [...Array(firstWeekday).fill(null), ...days];

  const weeks: (RentalOccupancyDay | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) {
    weeks.push(padded.slice(i, i + 7));
  }
  return weeks;
}

// Month label shown once, above the first week column whose first tracked
// day falls in that month — avoids repeating the same label on every one of
// its ~4 week-columns.
function monthMarks(weeks: (RentalOccupancyDay | null)[][]): Map<number, string> {
  const marks = new Map<number, string>();
  let lastMonth = -1;
  weeks.forEach((week, weekIndex) => {
    const firstDay = week.find((d) => d !== null);
    if (!firstDay) return;
    const month = parseDateOnly(firstDay.date).getMonth();
    if (month !== lastMonth) {
      marks.set(weekIndex, MONTH_LABELS[month]!);
      lastMonth = month;
    }
  });
  return marks;
}

// One CSS grid for the whole thing (label column + every week column,
// month-label row + the 7 weekday rows) rather than nested flex boxes —
// a single grid is what lets the weekday labels on the left line up
// perfectly with the calendar cells, since both sides share the exact same
// row tracks.
//
// Cells are a fixed square size (CELL_PX), not `1fr`/`aspect-square` sized
// from the card's own width or height: with only 7 rows spread across ~13
// week-columns, a square wide enough to fill the card's width is far taller
// than 7 of them fit in the card's height (and vice versa) — either produces
// a stretched rectangle or an overflowing grid, both tried here already.
// A fixed size that comfortably fits the card in both directions is the one
// approach that guarantees true squares that never overflow; the trade-off
// is it won't always fill 100% of the available width.
const CELL_PX = 28;
const LABEL_COLUMN_PX = 20;

export function OccupancyHeatmap({ days, totalCars }: OccupancyHeatmapProps) {
  if (days.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
        <AlertTriangle className="h-5 w-5" />
        Aucune donnée de location sur cette période.
      </div>
    );
  }

  const weeks = buildWeeks(days);
  const marks = monthMarks(weeks);
  const maxCount = Math.max(...days.map((d) => d.count));

  return (
    <div className="flex h-full flex-col">
      <div
        className="mx-auto grid w-fit gap-1"
        style={{
          gridTemplateColumns: `${LABEL_COLUMN_PX}px repeat(${weeks.length}, ${CELL_PX}px)`,
          gridTemplateRows: `auto repeat(7, ${CELL_PX}px)`,
        }}
      >
        <div />
        {weeks.map((_, weekIndex) => (
          <div key={weekIndex} className="text-[11px] leading-none text-muted-foreground">
            {marks.get(weekIndex) ?? ''}
          </div>
        ))}

        {WEEKDAY_LABELS.map((label, dayIndex) => (
          <Fragment key={dayIndex}>
            <span className="flex items-center justify-end pr-1 text-[10.5px] leading-none text-muted-foreground">
              {label}
            </span>
            {weeks.map((week, weekIndex) => {
              const day = week[dayIndex];
              if (!day) return <div key={weekIndex} className="h-full w-full" />;
              return (
                <Tooltip key={weekIndex}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        'h-full w-full rounded-[4px] transition-[filter] hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring',
                        BUCKET_CLASSNAME[bucketFor(day.count, maxCount)],
                      )}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    {formatDayLabel(parseDateOnly(day.date))} — {day.count} voiture{day.count > 1 ? 's' : ''} en
                    location{totalCars > 0 ? ` sur ${totalCars}` : ''}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </Fragment>
        ))}
      </div>

      <div className="mt-auto flex shrink-0 items-center justify-end gap-1.5 pt-2 text-[11px] text-muted-foreground">
        Faible
        {([0, 1, 2, 3, 4] as const).map((bucket) => (
          <span key={bucket} className={cn('h-2.5 w-2.5 rounded-[3px]', BUCKET_CLASSNAME[bucket])} />
        ))}
        Élevé
      </div>
    </div>
  );
}
