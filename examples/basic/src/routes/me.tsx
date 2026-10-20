import { A, createAsync, query } from "@solidjs/router";
import {
  ClerkShow,
  OrganizationSwitcher,
} from "@resonant-projects/clerk-solidjs";
import { auth } from "@resonant-projects/clerk-solidjs/start/server";
import { Suspense } from "solid-js";

const getAuthState = query(async () => {
  "use server";
  const authObject = auth();
  return {
    isAuthenticated: authObject.isAuthenticated,
    orgId: authObject.orgId ?? "",
    orgRole: authObject.orgRole ?? "",
    orgSlug: authObject.orgSlug ?? "",
    userId: authObject.userId ?? "",
  };
}, "me-auth-state");

export default function MePage() {
  const authState = createAsync(() => getAuthState());

  return (
    <div class="flex flex-col w-screen h-screen items-center justify-center gap-4 p-4">
      <Suspense fallback={<p>Loading...</p>}>
        <ClerkShow when="signed-in" fallback={<p>You are not signed in.</p>}>
          <p>
            Welcome! Your ID is <span data-testid="userId">{authState()?.userId}</span>!
          </p>
          <dl class="grid gap-2 text-center">
            <div>
              <dt class="font-semibold">Organization ID</dt>
              <dd data-testid="orgId">{authState()?.orgId}</dd>
            </div>
            <div>
              <dt class="font-semibold">Organization role</dt>
              <dd data-testid="orgRole">{authState()?.orgRole}</dd>
            </div>
            <div>
              <dt class="font-semibold">Organization slug</dt>
              <dd data-testid="orgSlug">{authState()?.orgSlug}</dd>
            </div>
          </dl>
          <OrganizationSwitcher
            fallback={<span class="text-slate-500">Loading organizations...</span>}
          />
        </ClerkShow>
      </Suspense>
      <A href="/" class="bg-slate-200 rounded-md px-3 py-1">
        Back
      </A>
    </div>
  );
}
