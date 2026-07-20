import * as React from "react";

import { cn } from "../lib/cn";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, rows = 3, ...props }, ref) => (
  <textarea
    ref={ref}
    rows={rows}
    className={cn(
      "flex w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink",
      "placeholder:text-ink-muted",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
      "disabled:cursor-not-allowed disabled:opacity-60",
      "aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
