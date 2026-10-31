import type { InputHTMLAttributes } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type SettingsNumberFieldProps = {
  id: string;
  label: string;
  // Shown inside the input, at its end: DT, j, %...
  unit: string;
  help: string;
  error?: string;
  inputProps: InputHTMLAttributes<HTMLInputElement>;
};

// One numeric setting. Stacked on wide screens (label, input, help); on a
// phone it's a settings-list row — the label on the left, a compact input
// on the right, the help across the full width underneath.
export function SettingsNumberField({ id, label, unit, help, error, inputProps }: SettingsNumberFieldProps) {
  return (
    <div className="space-y-2 max-sm:grid max-sm:grid-cols-[1fr_7.5rem] max-sm:items-center max-sm:gap-x-4 max-sm:gap-y-1.5 max-sm:space-y-0">
      <Label htmlFor={id} required className="max-sm:col-start-1 max-sm:row-start-1">
        {label}
      </Label>
      <div className="relative max-sm:col-start-2 max-sm:row-start-1">
        <Input id={id} type="number" className="pr-10 tabular-nums" {...inputProps} />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
          {unit}
        </span>
      </div>
      <p className="text-xs text-muted-foreground max-sm:col-span-2">
        {help}
      </p>
      {error && <p className="text-sm text-destructive max-sm:col-span-2">{error}</p>}
    </div>
  );
}
