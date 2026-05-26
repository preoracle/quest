import { useAuth } from "@/components/AuthProvider";
import { AuthModal } from "@/components/AuthModal";
import { Button } from "@/components/ui/button";

/** Header auth: sign-in button when signed out, user menu when signed in. */
export function AuthControls() {
  const { user, signOut } = useAuth();

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden text-xs text-on-muted lg:block">
          {user.email?.split("@")[0]}
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void signOut()}
          className="text-xs"
        >
          Sign out
        </Button>
      </div>
    );
  }

  return <AuthModal trigger="Sign in" size="sm" variant="outline" />;
}
