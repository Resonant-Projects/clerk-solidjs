import { A } from "@solidjs/router";
import { RedirectToSignIn, Show, useUser } from "@resonant-projects/clerk-solidjs";

// Without a server, the browser guards the page: a signed-out visitor is sent
// to sign-in and comes back here afterwards.
export default function Protected() {
  const { user } = useUser();
  return (
    <main>
      <Show when="signed-in" fallback={<RedirectToSignIn />}>
        <p>Welcome, {user()?.fullName || user()?.username || user()?.id}</p>
      </Show>
      <A href="/">Back</A>
    </main>
  );
}
