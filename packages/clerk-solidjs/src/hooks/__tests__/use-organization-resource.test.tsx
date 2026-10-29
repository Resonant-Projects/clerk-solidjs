import type {
  OrganizationMembershipResource,
  OrganizationResource,
  SignedInSessionResource,
  UserResource
} from '@clerk/shared/types';
import { cleanup, render } from '@solidjs/testing-library';
import { expectTypeOf } from 'expect-type';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClerkProvider, useOrganization } from '../..';
import {
  createFakeClerkJS,
  TEST_PUBLISHABLE_KEY
} from '../../__tests__/helpers/fake-clerk-js';

afterEach(() => {
  cleanup();
});

const signedIn = (organization: Partial<OrganizationResource>) => {
  const user = {
    id: 'user_1',
    organizationMemberships: [
      {
        id: 'orgmem_1',
        role: 'org:admin',
        permissions: [],
        organization: { id: organization.id }
      } as unknown as OrganizationMembershipResource
    ]
  } as unknown as UserResource;
  const session = {
    id: 'sess_1',
    status: 'active',
    user,
    lastActiveToken: { jwt: { claims: {} } }
  } as unknown as SignedInSessionResource;
  return {
    user,
    session,
    organization: organization as OrganizationResource
  };
};

describe('useOrganization resource fields', () => {
  it('exposes the self-serve Directory Sync setting from clerk-js', async () => {
    expectTypeOf<
      NonNullable<
        ReturnType<ReturnType<typeof useOrganization>['organization']>
      >
    >().toHaveProperty('selfServeDirectorySyncEnabled');

    const fixtures = signedIn({
      id: 'org_1',
      selfServeSSOEnabled: false,
      selfServeDirectorySyncEnabled: true
    });
    const { clerkJS } = createFakeClerkJS(fixtures);
    let result!: ReturnType<typeof useOrganization>;
    const Probe = () => {
      result = useOrganization();
      return null;
    };
    render(() => (
      <ClerkProvider
        publishableKey={TEST_PUBLISHABLE_KEY}
        Clerk={clerkJS as any}
      >
        <Probe />
      </ClerkProvider>
    ));

    await vi.waitFor(() => expect(result.isLoaded()).toBe(true));
    expect(result.organization()).toBe(fixtures.organization);
    expect(result.organization()?.selfServeDirectorySyncEnabled).toBe(true);
    expect(result.organization()?.selfServeSSOEnabled).toBe(false);
  });
});
