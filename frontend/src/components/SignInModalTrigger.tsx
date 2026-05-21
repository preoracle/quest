import { SignInButton } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SignInModalTriggerProps = {
  label?: string;
  size?: "sm" | "lg" | "default";
  variant?: "default" | "outline" | "ghost";
  className?: string;
};

/**
 * One entry point for auth: Clerk modal with sign-in and sign-up in the same flow.
 */
export function SignInModalTrigger({
  label = "Sign in",
  size = "sm",
  variant = "default",
  className,
}: SignInModalTriggerProps) {
  return (
    <SignInButton
      mode="modal"
      forceRedirectUrl="/dashboard"
      signUpForceRedirectUrl="/dashboard"
    >
      <Button type="button" size={size} variant={variant} className={cn(className)}>
        {label}
      </Button>
    </SignInButton>
  );
}
