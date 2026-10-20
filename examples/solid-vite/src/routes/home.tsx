import { A } from "@solidjs/router";
import {
  ClerkFailed,
  ClerkLoading,
  Show,
  SignInButton,
  SignOutButton,
  UserButton,
} from "@resonant-projects/clerk-solidjs";

export default function Home() {
  return (
    <main>
      <h1>clerk-solidjs</h1>
      <ClerkLoading>
        <p>Loading...</p>
      </ClerkLoading>
      <ClerkFailed>
        <p>Clerk failed to load.</p>
      </ClerkFailed>
      <Show when="signed-out">
        <div data-testid="signed-out-state">
          <SignInButton>
            <button>Sign in</button>
          </SignInButton>
          <A href="/sign-up">Sign up</A>
        </div>
      </Show>
      <Show when="signed-in">
        <div data-testid="signed-in-state">
          <UserButton />
          <SignOutButton />
        </div>
      </Show>
      <nav>
        <A href="/protected">Protected Page</A> <A href="/me">Me</A>{" "}
        <A href="/pricing">Pricing</A>
      </nav>
    </main>
  );
}
