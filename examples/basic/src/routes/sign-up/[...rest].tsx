import { SignUp } from "@resonant-projects/clerk-solidjs/start";

export default function SignUpPage() {
  return (
    <div class="flex w-screen h-screen items-center justify-center">
      <SignUp fallback={<p>Loading sign-up...</p>} />
    </div>
  );
}
