import * as React from "react";

import { cn } from "../lib/cn";

/**
 * Select nativo estilizado: hereda toda la accesibilidad y navegación por
 * teclado del elemento <select> del navegador (suficiente para esta fase;
 * un combobox Radix llegará solo si el producto lo exige).
 */
export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "flex h-10 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
      "disabled:cursor-not-allowed disabled:opacity-60",
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";
