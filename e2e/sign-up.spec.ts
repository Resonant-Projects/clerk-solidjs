import type { Locator } from "@playwright/test";

import {
  clerk,
  expect,
  makeClerkTestEmail,
  makeClerkTestUsername,
  test,
} from "./fixtures";

const signUpPassword = "ClerkSolidjs-E2E-Password1!";

async function fillIfVisible(
  locator: Locator,
  value: string,
) {
  if (await locator.isVisible().catch(() => false)) {
    await locator.fill(value);
  }
}

test("signs up with an email code and reaches a signed-in server state", async ({
  app,
  clerkClient,
  hasServer,
  page,
  registerCreatedUser,
}) => {
  const email = makeClerkTestEmail("playwright-sign-up");
  const username = makeClerkTestUsername("playwrightsignup");

  await app.signUp.goTo();
  await app.signUp.setEmailAddress(email);
  await fillIfVisible(app.signUp.getFirstNameInput(), "Playwright");
  await fillIfVisible(app.signUp.getLastNameInput(), "Sign Up");
  await fillIfVisible(app.signUp.getUsernameInput(), username);
  if (await app.signUp.getPasswordInput().isVisible().catch(() => false)) {
    await app.signUp.setPassword(signUpPassword);
    const confirmPasswordInput = page.locator('input[name="confirmPassword"]');
    if (await confirmPasswordInput.isVisible().catch(() => false)) {
      await app.signUp.setPasswordConfirmation(signUpPassword);
    }
  }
  if (await app.signUp.getLegalAccepted().isVisible().catch(() => false)) {
    await app.signUp.getLegalAccepted().check();
  }
  await app.signUp.continue();
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

  if (hasServer) {
    const me = await page.request.get("/api/me");
    expect(me.status()).toBe(200);
  }

  await page.goto("/");
  await clerk.signOut({ page });
  await expect(page.getByTestId("signed-out-state")).toBeVisible();
});
