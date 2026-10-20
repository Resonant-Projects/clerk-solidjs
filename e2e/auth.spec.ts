import type { Page } from "@playwright/test";

import { clerk, expect, test } from "./fixtures";

type ApiMeBody = {
  error?: string;
  orgId?: null | string;
  orgRole?: null | string;
  orgSlug?: null | string;
  tokenType?: string;
  userId?: null | string;
};

async function getApiMe(page: Page) {
  const response = await page.request.get("/api/me");
  const body = (await response.json().catch(() => null)) as ApiMeBody | null;
  return { body, response };
}

test("renders signed-out Show state and signed-out server auth headers", async ({
  page,
}) => {
  const response = await page.goto("/");

  expect(response?.headers()["x-clerk-auth-status"]).toBe("signed-out");
  await expect(page.getByTestId("signed-out-state")).toBeVisible();
  await expect(page.getByRole("button", { name: /^sign in$/i })).toBeVisible();

  const me = await getApiMe(page);
  expect(me.response.status()).toBe(401);
  expect(me.body).toEqual({ error: "Unauthorized" });
});

test("signs in, renders the protected page, exposes /api/me, then signs out cleanly", async ({
  page,
  primaryUser,
}) => {
  await page.goto("/");
  await clerk.loaded({ page });
  await clerk.signIn({ emailAddress: primaryUser.email, page });

  const signedInHome = await page.goto("/");
  expect(signedInHome?.headers()["x-clerk-auth-status"]).toBe("signed-in");
  await expect(page.getByTestId("signed-in-state")).toBeVisible();

  await page.goto("/protected");
  await expect(page).toHaveURL(/\/protected$/);
  await expect(page.getByText(/^Welcome,/)).toBeVisible();

  const me = await getApiMe(page);
  expect(me.response.status()).toBe(200);
  expect(me.body).toMatchObject({
    orgId: null,
    orgRole: null,
    orgSlug: null,
    tokenType: "session_token",
    userId: primaryUser.id,
  });

  await page.goto("/me");
  await expect(page.getByTestId("userId")).toHaveText(primaryUser.id);
  await expect(page.getByTestId("orgId")).toHaveText("");
  await expect(page.getByTestId("orgRole")).toHaveText("");
  await expect(page.getByTestId("orgSlug")).toHaveText("");

  await page.goto("/");
  await clerk.signOut({ page });

  await expect(page.getByTestId("signed-out-state")).toBeVisible();

  const afterSignOut = await getApiMe(page);
  expect(afterSignOut.response.status()).toBe(401);

  await page.goto("/protected");
  await expect(page).toHaveURL(/\/sign-in\?/);
});

test("restores a signed-in session after the session cookie is cleared", async ({
  context,
  page,
  primaryUser,
}) => {
  await page.goto("/");
  await clerk.loaded({ page });
  await clerk.signIn({ emailAddress: primaryUser.email, page });

  await page.goto("/protected");
  await expect(page).toHaveURL(/\/protected$/);

  await context.clearCookies({ name: /__session.*/ });

  await page.goto("/protected");
  await expect(page).toHaveURL(/\/protected$/);
  await expect(page.getByText(/^Welcome,/)).toBeVisible();

  const sessionCookies = (await context.cookies()).filter((cookie) =>
    cookie.name.startsWith("__session"),
  );
  expect(sessionCookies.length).toBeGreaterThan(0);

  const me = await getApiMe(page);
  expect(me.response.status()).toBe(200);
  expect(me.body?.userId).toBe(primaryUser.id);
});
