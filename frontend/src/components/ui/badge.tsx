import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      // Soft-tint style for every status color, not just `default` — a
      // pale background at the status hue plus dark-on-light/light-on-dark
      // text of that same hue, instead of a solid fill with white text.
      // Quieter for a table full of status pills, and it sidesteps the
      // white-text-on-amber contrast problem `warning` used to need a
      // one-off fix for: a pale tint never needs white text to begin with.
      // green-700/red-700 stand in for success/destructive in light mode
      // because those tokens have no numbered scale of their own (unlike
      // primary) to pull a "darker for light-mode text" shade from; dark
      // mode needs no such stand-in since --success/--destructive/
      // --warning/--primary are already tuned light enough to read on a
      // dark tint as-is.
      variant: {
        default:
          "border-transparent bg-primary/15 text-primary-700 hover:bg-primary/25 dark:text-primary",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive/15 text-red-700 hover:bg-destructive/25 dark:text-destructive",
        success:
          "border-transparent bg-success/15 text-green-700 hover:bg-success/25 dark:text-success",
        // text-warning-foreground (not text-warning) in light mode — it's
        // already the dark amber chosen for AA contrast against a *solid*
        // warning fill, which reads even better against this much paler
        // tint; --warning itself is too bright to use as text on its own
        // background at any tint level.
        warning:
          "border-transparent bg-warning/15 text-warning-foreground hover:bg-warning/25 dark:text-warning",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
