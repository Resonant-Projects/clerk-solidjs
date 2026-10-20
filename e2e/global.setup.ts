import { clerkSetup } from "@clerk/testing/playwright";

import { getClerkE2EEnv } from "./clerk-env";
import {
  createClerkE2EClient,
  makeClerkTestEmail,
  resetClerkE2EState,
  writeClerkE2EState,
} from "./clerk-state";

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
  const primaryUser = await clerkClient.users.createUser({
    emailAddress: [email],
    skipPasswordRequirement: true,
  });

  writeClerkE2EState({
    createdOrganizationIds: [],
    createdUsers: [],
    primaryUser: {
      email,
      id: primaryUser.id,
    },
  });
}
