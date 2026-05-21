import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn(
      "flex h-11 w-full rounded-lg border border-line bg-surface px-4 text-sm text-on-surface shadow-inner shadow-black/20 placeholder:text-on-muted/70 transition-colors focus-visible:border-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20",
      className,
    )}
    ref={ref}
    {...props}
  />
));
Input.displayName = "Input";
