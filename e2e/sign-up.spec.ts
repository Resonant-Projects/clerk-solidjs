import { clerk, expect, makeClerkTestEmail, test } from "./fixtures";

test("signs up with an email code and reaches a signed-in server state", async ({
  app,
  clerkClient,
  page,
  registerCreatedUser,
}) => {
  const email = makeClerkTestEmail("playwright-sign-up");

  await app.signUp.goTo();
  await app.signUp.signUp({ email });
  await app.signUp.enterTestOtpCode();
  await app.expect.toBeSignedIn();

  const createdUsers = await clerkClient.users.getUserList({
    emailAddress: [email],
  });
  const createdUser = createdUsers.data[0];

  expect(createdUser, `Expected Clerk to create a user for ${email}`).toBeTruthy();
  registerCreatedUser({
    email,
    id: createdUser.id,
  });

  await page.goto("/me");
  await expect(page.getByTestId("userId")).toHaveText(createdUser.id);

  const me = await page.request.get("/api/me");
  expect(me.status()).toBe(200);

  await page.goto("/");
  await clerk.signOut({ page });
  await expect(page.getByTestId("signed-out-state")).toBeVisible();
});
