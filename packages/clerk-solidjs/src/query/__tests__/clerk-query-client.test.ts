import { focusManager, onlineManager } from '@tanstack/query-core';
import { afterEach, describe, expect, it } from 'vitest';
import {
  __setClerkQueryClientForTest,
  getClerkQueryClient
} from '../clerk-query-client';

afterEach(() => {
  __setClerkQueryClientForTest(undefined);
});

describe('the shared Clerk QueryClient', () => {
  it('is mounted, so paused retries resume on focus and reconnect', () => {
    __setClerkQueryClientForTest(undefined);
    expect(focusManager.hasListeners()).toBe(false);
    expect(onlineManager.hasListeners()).toBe(false);

    getClerkQueryClient();

    expect(focusManager.hasListeners()).toBe(true);
    expect(onlineManager.hasListeners()).toBe(true);
  });

  it('does not refetch on focus or reconnect, like @clerk/react', () => {
    __setClerkQueryClientForTest(undefined);
    const queries = getClerkQueryClient()!.getDefaultOptions().queries;

    expect(queries?.refetchOnWindowFocus).toBe(false);
    expect(queries?.refetchOnReconnect).toBe(false);
  });

  it('is one instance for the page', () => {
    __setClerkQueryClientForTest(undefined);
    expect(getClerkQueryClient()).toBe(getClerkQueryClient());
  });
});
