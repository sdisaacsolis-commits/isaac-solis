import * as React from "react";

import { cn } from "../lib/cn";

/** Marcador de carga; aria-hidden porque no aporta información al lector. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-lg bg-surface-muted", className)}
      {...props}
    />
  );
}
