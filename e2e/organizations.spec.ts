import {
  clerk,
  expect,
  makeOrganizationName,
  makeOrganizationSlug,
  test,
} from "./fixtures";

const isOrganizationsDisabledError = (error: unknown) =>
  error instanceof Error &&
  /(organization|feature).*(disabled|enable|not available|not enabled)/i.test(
    error.message,
  );

test("switches organizations and reflects the active organization in server auth()", async ({
  app,
  clerkClient,
  page,
  primaryUser,
  registerCreatedOrganization,
}) => {
  await page.goto("/");
  await clerk.loaded({ page });
  await clerk.signIn({ emailAddress: primaryUser.email, page });

  let firstOrganization;
  let secondOrganization;

  try {
    firstOrganization = await clerkClient.organizations.createOrganization({
      createdBy: primaryUser.id,
      name: makeOrganizationName("Playwright First Org"),
      slug: makeOrganizationSlug("playwright-first-org"),
    });
    secondOrganization = await clerkClient.organizations.createOrganization({
      createdBy: primaryUser.id,
      name: makeOrganizationName("Playwright Second Org"),
      slug: makeOrganizationSlug("playwright-second-org"),
    });
  } catch (error) {
    if (isOrganizationsDisabledError(error)) {
      test.skip(
        true,
        "Organizations are not enabled on this Clerk instance. Enable organizations in the Clerk dashboard to run this spec.",
      );
    }
    throw error;
  }

  registerCreatedOrganization(firstOrganization.id);
  registerCreatedOrganization(secondOrganization.id);

  await page.goto("/me");
  await app.organizationSwitcher.waitForMounted();

  await app.organizationSwitcher.toggleTrigger();
  await page.getByText(firstOrganization.name, { exact: true }).click();
  await page.waitForLoadState("networkidle");
  await page.reload();

  await expect(page.getByTestId("orgId")).toHaveText(firstOrganization.id);
  await expect(page.getByTestId("orgRole")).toHaveText("org:admin");
  await expect(page.getByTestId("orgSlug")).toHaveText(firstOrganization.slug);

  const firstApiMe = await page.request.get("/api/me");
  const firstApiMeBody = await firstApiMe.json();
  expect(firstApiMe.status()).toBe(200);
  expect(firstApiMeBody.orgId).toBe(firstOrganization.id);

  await app.organizationSwitcher.toggleTrigger();
  await page.getByText(secondOrganization.name, { exact: true }).click();
  await page.waitForLoadState("networkidle");
  await page.reload();

  await expect(page.getByTestId("orgId")).toHaveText(secondOrganization.id);
  await expect(page.getByTestId("orgRole")).toHaveText("org:admin");
  await expect(page.getByTestId("orgSlug")).toHaveText(secondOrganization.slug);

  const secondApiMe = await page.request.get("/api/me");
  const secondApiMeBody = await secondApiMe.json();
  expect(secondApiMe.status()).toBe(200);
  expect(secondApiMeBody.orgId).toBe(secondOrganization.id);
  expect(secondApiMeBody.orgRole).toBe("org:admin");
  expect(secondApiMeBody.orgSlug).toBe(secondOrganization.slug);
});
