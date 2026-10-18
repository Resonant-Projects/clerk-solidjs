---
"@resonant-projects/clerk-solidjs": minor
---

The rest of `@clerk/react`'s components and hooks, apart from billing.

- **Components:** `PricingTable` (its fallback waits until the plans are fetched), `APIKeys`, `UserAvatar`, `OAuthConsent`, `OAuthDeviceVerification` and `InviteMembersButton`.
- **Hooks:**
  - `useAPIKeys()` pages through API keys.
  - `useOAuthConsent()` reads an OAuth application's consent info.
  - `useOAuthDeviceVerification()` looks up, approves or denies a device code.
  - `useOrganizationCreationDefaults()` returns the suggested organization defaults.

  Params that can change are accessors.

- **The enable-organizations prompt:** on a development instance without organizations, `useOrganization()`, and `useOrganizationList()` with list params, ask Clerk once to offer turning them on.
- **`UNSAFE_PortalProvider`:** renders Clerk's components and modals inside the element its `getContainer` returns, such as a dialog.
- **`getToken()`** is exported from the root entry.
