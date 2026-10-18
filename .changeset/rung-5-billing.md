---
"@resonant-projects/clerk-solidjs": minor
---

Billing, from a new `@resonant-projects/clerk-solidjs/experimental` entry. It is experimental in `@clerk/react` too, so its API can change in a minor release.

- **Buttons:** `CheckoutButton`, `PlanDetailsButton` and `SubscriptionDetailsButton` open Clerk's billing drawers. Render them for a signed-in user, and with `for="organization"` only with an active organization.
- **Hooks:**
  - `usePlans()`, `useStatements()`, `usePaymentAttempts()` and `usePaymentMethods()` page through billing data.
  - `useSubscription()` returns the user's or organization's subscription.
  - `useCheckout()`, with `CheckoutProvider`, drives a custom checkout from clerk-js's checkout signal.

  Params that can change are accessors.

- **Payment form:** `PaymentElementProvider`, `PaymentElement` and `usePaymentElement()` render Stripe's payment form and submit it. Clerk loads Stripe.js itself.
- The billing members of the Clerk instance (`billing`, `__experimental_checkout` and the drawer methods) are no longer stubs.
