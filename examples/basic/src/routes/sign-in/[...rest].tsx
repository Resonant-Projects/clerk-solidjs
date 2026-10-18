import { SignIn } from "@resonant-projects/clerk-solidjs/start";

// A catch-all route, so SignIn can route its own steps (/sign-in/factor-one and
// so on). The /start SignIn takes its path from the route.
export default function SignInPage() {
  return (
    <div class="flex w-screen h-screen items-center justify-center">
      <SignIn fallback={<p>Loading sign-in...</p>} />
    </div>
  );
}
