import { clerkSetup } from "@clerk/testing/playwright";
import type { FullConfig } from "@playwright/test";

import { getClerkE2EEnv } from "./clerk-env";
import {
  createClerkE2EClient,
  makeClerkTestEmail,
  makeClerkTestUsername,
  resetClerkE2EState,
  writeClerkE2EState,
} from "./clerk-state";

function describeClerkError(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "errors" in error &&
    Array.isArray((error as { errors: Array<Record<string, unknown>> }).errors)
  ) {
    const messages = (error as { errors: Array<Record<string, unknown>> }).errors
      .map((entry) =>
        [entry.code, entry.message, entry.longMessage]
          .filter((value): value is string => typeof value === "string" && value.length > 0)
          .join(": "),
      )
      .filter(Boolean);

    if (messages.length > 0) {
      return messages.join(" | ");
    }
  }

  return error instanceof Error ? error.message : String(error);
}

async function createPrimaryUser(
  clerkClient: ReturnType<typeof createClerkE2EClient>,
  email: string,
) {
  const username = makeClerkTestUsername("playwright-existing-user");
  const attempts: Array<{
    label: string;
    params: Parameters<typeof clerkClient.users.createUser>[0];
  }> = [
    {
      label: "email-only",
      params: {
        emailAddress: [email],
      },
    },
    {
      label: "email-and-password",
      params: {
        emailAddress: [email],
        password: "ClerkSolidjs-E2E-Password1!",
      },
    },
    {
      label: "email-username-and-password",
      params: {
        emailAddress: [email],
        password: "ClerkSolidjs-E2E-Password1!",
        username,
      },
    },
  ];

  let lastError: unknown;

  for (const attempt of attempts) {
    try {
      return await clerkClient.users.createUser(attempt.params);
    } catch (error) {
      lastError = error;
      console.warn(
        `[clerk e2e] createUser ${attempt.label} failed: ${describeClerkError(error)}`,
      );
    }
  }

  throw new Error(
    `Unable to create the Clerk E2E user with either supported user shape: ${describeClerkError(lastError)}`,
  );
}

export default async function globalSetup(config: FullConfig) {
  const { publishableKey, secretKey } = getClerkE2EEnv();

  await clerkSetup({
    debug: !!process.env.CLERK_TESTING_DEBUG,
    dotenv: false,
    publishableKey,
    secretKey,
  });

  resetClerkE2EState();

  const clerkClient = createClerkE2EClient();
  const primaryUsers: Record<string, { email: string; id: string }> = {};
  try {
    for (const project of config.projects) {
      const email = makeClerkTestEmail(`playwright-${project.name}`);
      const user = await createPrimaryUser(clerkClient, email);
      primaryUsers[project.name] = { email, id: user.id };
    }
  } finally {
    // Teardown deletes whichever users were made, even if one failed.
    writeClerkE2EState({
      createdOrganizationIds: [],
      createdUsers: [],
      primaryUsers,
    });
  }
}
