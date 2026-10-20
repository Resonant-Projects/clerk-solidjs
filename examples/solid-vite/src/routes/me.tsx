import { A } from "@solidjs/router";
import { OrganizationSwitcher, Show, useAuth } from "@resonant-projects/clerk-solidjs";

// The browser's view of the session; examples/basic's /me reads the same
// fields from the server's auth().
export default function Me() {
  const { userId, orgId, orgRole, orgSlug } = useAuth();
  return (
    <main>
      <Show when="signed-in" fallback={<p>You are not signed in.</p>}>
        <p>
          Welcome! Your ID is <span data-testid="userId">{userId()}</span>!
        </p>
        <dl>
          <dt>Organization ID</dt>
          <dd data-testid="orgId">{orgId() ?? ""}</dd>
          <dt>Organization role</dt>
          <dd data-testid="orgRole">{orgRole() ?? ""}</dd>
          <dt>Organization slug</dt>
          <dd data-testid="orgSlug">{orgSlug() ?? ""}</dd>
        </dl>
        <OrganizationSwitcher fallback={<span>Loading organizations...</span>} />
      </Show>
      <A href="/">Back</A>
    </main>
  );
}
