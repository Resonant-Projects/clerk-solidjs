// The smoke run's signed-in checks, with a throwaway user.

import { check, secrets } from "./report.mjs";

/** Calls Clerk's Backend API with the instance's secret key. */
async function backendApi(method, pathname, body) {
  const response = await fetch(`https://api.clerk.com/v1/${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    // Clerk's error codes and messages say what the instance requires, and
    // carry no credentials.
    const body = await response.json().catch(() => ({}));
    const reasons = (body.errors ?? [])
      .map((error) => `${error.code}: ${error.long_message ?? error.message}`)
      .join("; ");
    throw new Error(
      `Backend API ${method} /${pathname.replace(/\/.*$/, "")}: ${response.status}${reasons ? ` (${reasons})` : ""}`,
    );
  }
  return response.json();
}

// What else the instance requires of a new user, from its public settings.
// 555-01xx numbers are test numbers, like +clerk_test addresses.
async function requiredUserFields() {
  const encoded = process.env.VITE_CLERK_PUBLISHABLE_KEY.split("_")[2] ?? "";
  const frontendApi = Buffer.from(encoded, "base64")
    .toString()
    .replace(/\$$/, "");
  const response = await fetch(`https://${frontendApi}/v1/environment`);
  if (!response.ok) {
    throw new Error(`Frontend API /v1/environment: ${response.status}`);
  }
  const { attributes } = (await response.json()).user_settings;
  const required = (name) =>
    !!attributes[name]?.enabled && !!attributes[name]?.required;
  return {
    ...(required("first_name") && { first_name: "Smoke" }),
    ...(required("last_name") && { last_name: "Test" }),
    ...(required("username") && { username: `smoke_${Date.now()}` }),
    ...(required("phone_number") && {
      phone_number: [
        `+1201555${String(100 + Math.floor(Math.random() * 100)).padStart(4, "0")}`,
      ],
    }),
  };
}

// Signs a new test user in with a sign-in token, then opens the example's
// UserProfileModal, whose deep link to its own page relies on clerk-js
// honouring customPages and __experimental_startPath. The user is deleted
// afterwards, whatever happens. The example adds a page above 1024px, so
// resizing the window changes the modal's pages.
export async function runSignedInChecks(browser, baseUrl) {
  const user = await backendApi("POST", "users", {
    email_address: [`smoke-${Date.now()}+clerk_test@example.com`],
    skip_password_requirement: true,
    ...(await requiredUserFields()),
  });
  let context;
  try {
    context = await browser.newContext({
      viewport: { width: 900, height: 800 },
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error")
        errors.push(`console.error: ${message.text()}`);
    });

    const { token } = await backendApi("POST", "sign_in_tokens", {
      user_id: user.id,
      expires_in_seconds: 300,
    });
    secrets.add(token);
    // <SignIn /> signs in with a ticket from the URL.
    const signInUrl = new URL("/sign-in", baseUrl);
    signInUrl.searchParams.set("__clerk_ticket", token);
    await page.goto(signInUrl.href, { waitUntil: "domcontentloaded" });
    const signedIn = await page
      .waitForFunction(() => !!window.Clerk?.user, null, { timeout: 30_000 })
      .then(() => true)
      .catch(() => false);
    check("a sign-in token signs the test user in", signedIn);

    // See runChecks for why this does not wait for "networkidle".
    await page.goto(baseUrl, { waitUntil: "load" });
    await page
      .waitForFunction(
        () => window.Clerk?.loaded === true && !!window.Clerk.user,
        null,
        { timeout: 30_000 },
      )
      .catch(() => {});
    const openButton = page.getByRole("button", { name: "Open preferences" });
    const modal = page.locator(".cl-modalContent .cl-userProfile-root");
    const preferences = modal.getByTestId("preferences-page");
    // The navbar shows at this width, so a missing page is really missing.
    const preferencesItem = modal.getByRole("button", { name: "Preferences" });
    const wideScreensItem = modal.getByRole("button", { name: "Wide screens" });
    await openButton.click({ timeout: 30_000 });
    const openedOnPage = await preferences
      .waitFor({ timeout: 30_000 })
      .then(() => true)
      .catch(() => false);
    check(
      "UserProfileModal opens on its own page from __experimental_startPath",
      openedOnPage &&
        (await preferencesItem.isVisible()) &&
        (await wideScreensItem.count()) === 0,
    );

    // A page added while the modal is open appears, and the user stays put.
    await page.setViewportSize({ width: 1280, height: 800 });
    const addedInPlace = await wideScreensItem
      .waitFor({ timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    check(
      "a page added to the open modal appears without moving the user",
      addedInPlace && (await preferences.isVisible()),
    );
    check(
      "the page's Solid content stays reactive inside Clerk's modal",
      ((await preferences.textContent()) ?? "").includes("1280px wide"),
    );

    await page.keyboard.press("Escape");
    const closed = await modal
      .waitFor({ state: "detached", timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    check("Escape closes the modal", closed);

    // The page leaves while the modal is closed; that must not reopen it. If
    // it calls openUserProfile anyway, clerk-js either reopens the modal or
    // ignores the next open, depending on timing, so the next check matters too.
    await page.setViewportSize({ width: 900, height: 800 });
    await page.waitForTimeout(2_000);
    check(
      "a closed UserProfileModal stays closed when its pages change",
      closed && (await modal.count()) === 0,
    );

    await openButton.click();
    const reopened = await preferences
      .waitFor({ timeout: 30_000 })
      .then(() => true)
      .catch(() => false);
    check(
      "opening it again lands on its own page again, without the page that left",
      reopened &&
        (await preferencesItem.isVisible()) &&
        (await wideScreensItem.count()) === 0,
    );

    check(
      "no page errors or console errors while signed in",
      errors.length === 0,
      errors.join(" | "),
    );
  } finally {
    // A context that failed to open or close must not keep the user.
    await context?.close().catch(() => {});
    await backendApi("DELETE", `users/${user.id}`);
  }
}
