import {
  clerkE2EStatePath,
  createClerkE2EClient,
  readClerkE2EState,
  removeClerkE2EState,
} from "./clerk-state";

const isMissingResourceError = (error: unknown) =>
  error instanceof Error &&
  /(404|not found|already been deleted)/i.test(error.message);

export default async function globalTeardown() {
  const state = readClerkE2EState();
  removeClerkE2EState();

  if (
    !state.primaryUser &&
    state.createdUsers.length === 0 &&
    state.createdOrganizationIds.length === 0
  ) {
    return;
  }

  const clerkClient = createClerkE2EClient();

  for (const organizationId of [...state.createdOrganizationIds].reverse()) {
    try {
      await clerkClient.organizations.deleteOrganization(organizationId);
    } catch (error) {
      if (!isMissingResourceError(error)) {
        throw new Error(
          `Failed to delete E2E organization ${organizationId} from ${clerkE2EStatePath}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  const users = state.primaryUser
    ? [...state.createdUsers, state.primaryUser]
    : [...state.createdUsers];

  for (const user of [...users].reverse()) {
    try {
      await clerkClient.users.deleteUser(user.id);
    } catch (error) {
      if (!isMissingResourceError(error)) {
        throw new Error(
          `Failed to delete E2E user ${user.email}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }
}
