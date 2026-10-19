import * as React from "react";
import { cn } from "@/lib/utils";

/** Standard page title — use for the one <h1> on every top-level page so headings share a
 *  single size/weight across modules. Layout (badges, actions beside it) stays with the page. */
export function PageTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h1 className={cn("text-2xl font-bold tracking-tight text-foreground", className)} {...props} />;
}

/** Standard subtitle shown under a PageTitle. */
export function PageDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}
