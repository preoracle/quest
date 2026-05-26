import { AuthModal } from "@/components/AuthModal";
import { cn } from "@/lib/utils";

type SignInModalTriggerProps = {
  label?: string;
  size?: "sm" | "lg" | "default";
  variant?: "default" | "outline" | "ghost";
  className?: string;
};

/** Drop-in replacement for the old Clerk SignInButton. */
export function SignInModalTrigger({
  label = "Sign in",
  size = "sm",
  variant = "default",
  className,
}: SignInModalTriggerProps) {
  return (
    <AuthModal trigger={label} size={size} variant={variant} className={cn(className)} />
  );
}
