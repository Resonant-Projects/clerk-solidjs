import { getClerkE2EEnv } from "./clerk-env";
import { clerk, expect, test } from "./fixtures";

/** Whether the instance bills users, from its public settings. */
async function userBillingEnabled() {
  // pk_test_<base64 of "<frontend API host>$">
  const encoded = getClerkE2EEnv().publishableKey.split("_")[2] ?? "";
  const frontendApi = Buffer.from(encoded, "base64").toString().replace(/\$$/, "");
  const response = await fetch(`https://${frontendApi}/v1/environment`);
  if (!response.ok) throw new Error(`Frontend API /v1/environment: ${response.status}`);
  const environment = await response.json();
  return !!environment.commerce_settings?.billing?.user?.enabled;
}

test("the pricing table shows the instance's plans, and its fallback goes", async ({
  clerkClient,
  page,
  primaryUser,
}) => {
  test.skip(
    !(await userBillingEnabled()),
    "Billing for users is off in this Clerk instance. Turn it on, with a public plan, to run this.",
  );
  const { data: plans } = await clerkClient.billing.getPlanList({ payerType: "user" });
  const visible = plans.filter((plan) => plan.publiclyVisible);
  test.skip(visible.length === 0, "The instance has no public user plans.");

  await page.goto("/");
  await clerk.loaded({ page });
  await clerk.signIn({ emailAddress: primaryUser.email, page });

  await page.goto("/pricing");
  await expect(page.locator(".cl-pricingTable-root")).toBeVisible();
  // The fallback stays until Clerk marks the table ready.
  await expect(page.getByText("Loading plans...")).toHaveCount(0);
  for (const plan of visible) {
    await expect(
      page.locator(".cl-pricingTableCard").filter({ hasText: plan.name }).first(),
    ).toBeVisible();
  }
});
