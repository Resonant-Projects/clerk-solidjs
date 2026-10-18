import { A, createAsync, query } from "@solidjs/router";
import { auth, clerkClient } from "@resonant-projects/clerk-solidjs/start/server";
import { Suspense } from "solid-js";

// Runs on the server. A signed-out visitor is sent to sign-in and comes back
// here afterwards.
const getProfile = query(async () => {
  "use server";
  const { userId, redirectToSignIn } = auth();
  if (!userId) throw redirectToSignIn();
  const user = await clerkClient().users.getUser(userId);
  return { name: user.fullName || user.username || user.id };
}, "profile");

export default function ProtectedPage() {
  const profile = createAsync(() => getProfile());

  return (
    <div class="flex flex-col w-screen h-screen items-center justify-center gap-2">
      <Suspense fallback={<p>Loading...</p>}>
        <p>Welcome, {profile()?.name}</p>
      </Suspense>
      <A href="/" class="bg-slate-200 rounded-md px-3 py-1">
        Back
      </A>
    </div>
  );
}
