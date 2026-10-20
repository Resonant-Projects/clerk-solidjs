import { clerkSetup } from "@clerk/testing/playwright";

import { getClerkE2EEnv } from "./clerk-env";
import {
  createClerkE2EClient,
  makeClerkTestEmail,
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

export default async function globalSetup() {
  const { publishableKey, secretKey } = getClerkE2EEnv();

  await clerkSetup({
    debug: !!process.env.CLERK_TESTING_DEBUG,
    dotenv: false,
    publishableKey,
    secretKey,
  });

  resetClerkE2EState();

  const clerkClient = createClerkE2EClient();
  const email = makeClerkTestEmail("playwright-existing-user");
  const primaryUser = await createPrimaryUser(clerkClient, email);

  writeClerkE2EState({
    createdOrganizationIds: [],
    createdUsers: [],
    primaryUser: {
      email,
      id: primaryUser.id,
    },
  });
}
