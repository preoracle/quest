import { Show, UserButton } from "@clerk/react";
import { SignInModalTrigger } from "@/components/SignInModalTrigger";

/** Header auth: one modal trigger when signed out, user menu when signed in. */
export function AuthControls() {
  return (
    <div className="flex items-center gap-2">
      <Show when="signed-out">
        <SignInModalTrigger label="Sign in" size="sm" variant="outline" />
      </Show>
      <Show when="signed-in">
        <UserButton
          appearance={{
            elements: {
              avatarBox: "size-8",
            },
          }}
        />
      </Show>
    </div>
  );
}
