import { SignUp } from "@resonant-projects/clerk-solidjs";

export default function SignUpPage() {
  return <SignUp routing="path" path="/sign-up" fallback={<p>Loading sign-up...</p>} />;
}
