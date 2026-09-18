import * as React from "react"
import { Eye, EyeOff } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "./input"

// Wraps Input rather than extending it inline everywhere a password field
// is needed — the show/hide toggle is a few lines of state + an absolutely
// positioned button that would otherwise get copy-pasted at every call site.
const PasswordInput = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false)

    return (
      <div className="relative">
        <Input type={visible ? "text" : "password"} className={cn("pr-9", className)} ref={ref} {...props} />
        <button
          type="button"
          // Skipped in tab order — the field's own value is what Tab should
          // land on next, not a toggle most people never touch.
          tabIndex={-1}
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    )
  }
)
PasswordInput.displayName = "PasswordInput"

export { PasswordInput }
