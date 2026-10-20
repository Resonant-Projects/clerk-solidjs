import { SignIn } from "@resonant-projects/clerk-solidjs";

// The route is /sign-in/*, so SignIn can route its own steps.
export default function SignInPage() {
  return <SignIn routing="path" path="/sign-in" fallback={<p>Loading sign-in...</p>} />;
}
