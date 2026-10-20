import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import { createPageObjects } from "@clerk/testing/playwright/unstable";
import { expect, test as base } from "@playwright/test";

import type { TrackedUser } from "./clerk-state";
import {
  createClerkE2EClient,
  makeClerkTestEmail,
  makeClerkTestUsername,
  makeOrganizationName,
  makeOrganizationSlug,
  readClerkE2EState,
  trackCreatedOrganization,
  trackCreatedUser,
} from "./clerk-state";

type E2EFixtures = {
  app: ReturnType<typeof createPageObjects>;
  /** The SolidStart app has a server: middleware, auth() and API routes. */
  hasServer: boolean;
  clerkClient: ReturnType<typeof createClerkE2EClient>;
  primaryUser: TrackedUser;
  registerCreatedOrganization: (organizationId: string) => void;
  registerCreatedUser: (user: TrackedUser) => void;
};

export const test = base.extend<E2EFixtures>({
  page: async ({ context, page }, use) => {
    await setupClerkTestingToken({ context });
    await use(page);
  },

  app: async ({ baseURL, page }, use) => {
    await use(
      createPageObjects({
        baseURL,
        page,
        useTestingToken: false,
      }),
    );
  },

  hasServer: async ({}, use, testInfo) => {
    await use(testInfo.project.name === "basic");
  },

  clerkClient: async ({}, use) => {
    await use(createClerkE2EClient());
  },

  primaryUser: async ({}, use) => {
    const state = readClerkE2EState();
    if (!state.primaryUser) {
      throw new Error("Missing primary Clerk E2E user from global setup.");
    }
    await use(state.primaryUser);
  },

  registerCreatedOrganization: async ({}, use) => {
    await use((organizationId: string) => {
      trackCreatedOrganization(organizationId);
    });
  },

  registerCreatedUser: async ({}, use) => {
    await use((user: TrackedUser) => {
      trackCreatedUser(user);
    });
  },
});

export {
  clerk,
  expect,
  makeClerkTestEmail,
  makeClerkTestUsername,
  makeOrganizationName,
  makeOrganizationSlug,
};
