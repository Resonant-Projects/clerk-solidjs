import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createClerkClient } from "@clerk/backend";

import { getClerkE2EEnv } from "./clerk-env";

export type TrackedUser = {
  email: string;
  id: string;
};

export type ClerkE2EState = {
  createdOrganizationIds: string[];
  createdUsers: TrackedUser[];
  primaryUser: null | TrackedUser;
};

export const clerkE2EStatePath = path.join(
  os.tmpdir(),
  "clerk-solidjs-e2e-state.json",
);

export function createClerkE2EClient() {
  const { publishableKey, secretKey } = getClerkE2EEnv();
  return createClerkClient({ publishableKey, secretKey });
}

export function defaultClerkE2EState(): ClerkE2EState {
  return {
    createdOrganizationIds: [],
    createdUsers: [],
    primaryUser: null,
  };
}

export function readClerkE2EState(): ClerkE2EState {
  if (!fs.existsSync(clerkE2EStatePath)) {
    return defaultClerkE2EState();
  }

  return {
    ...defaultClerkE2EState(),
    ...JSON.parse(fs.readFileSync(clerkE2EStatePath, "utf8")),
  };
}

export function writeClerkE2EState(state: ClerkE2EState) {
  fs.writeFileSync(
    clerkE2EStatePath,
    `${JSON.stringify(state, null, 2)}\n`,
    "utf8",
  );
}

export function resetClerkE2EState() {
  writeClerkE2EState(defaultClerkE2EState());
}

export function removeClerkE2EState() {
  fs.rmSync(clerkE2EStatePath, { force: true });
}

export function trackCreatedUser(user: TrackedUser) {
  const state = readClerkE2EState();
  if (!state.createdUsers.some((entry) => entry.id === user.id)) {
    state.createdUsers.push(user);
    writeClerkE2EState(state);
  }
}

export function trackCreatedOrganization(organizationId: string) {
  const state = readClerkE2EState();
  if (!state.createdOrganizationIds.includes(organizationId)) {
    state.createdOrganizationIds.push(organizationId);
    writeClerkE2EState(state);
  }
}

export function makeClerkTestEmail(prefix: string) {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now()}-${suffix}+clerk_test@example.com`;
}

export function makeClerkTestUsername(prefix: string) {
  const compactPrefix = prefix.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return `${compactPrefix}${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

export function makeOrganizationName(prefix: string) {
  return `${prefix} ${Date.now()} ${Math.random().toString(36).slice(2, 6)}`;
}

export function makeOrganizationSlug(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}
