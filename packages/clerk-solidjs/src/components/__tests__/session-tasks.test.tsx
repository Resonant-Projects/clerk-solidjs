import { cleanup, render } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ClerkProvider,
  RedirectToTasks,
  TaskChooseOrganization,
  TaskResetPassword,
  TaskSetupMFA
} from '../..';
import {
  createFakeClerkJS,
  TEST_PUBLISHABLE_KEY
} from '../../__tests__/helpers/fake-clerk-js';

const setup = () => {
  const { clerkJS } = createFakeClerkJS();
  const members = {
    mountTaskChooseOrganization: vi.fn(),
    unmountTaskChooseOrganization: vi.fn(),
    mountTaskResetPassword: vi.fn(),
    unmountTaskResetPassword: vi.fn(),
    mountTaskSetupMFA: vi.fn(),
    unmountTaskSetupMFA: vi.fn(),
    redirectToTasks: vi.fn(async () => {})
  };
  return { clerkJS: Object.assign(clerkJS, members), members };
};

afterEach(() => {
  cleanup();
});

describe('session tasks', () => {
  it('mount each task component with its props, and unmount it', async () => {
    const { clerkJS, members } = setup();
    const { unmount } = render(() => (
      <ClerkProvider
        publishableKey={TEST_PUBLISHABLE_KEY}
        Clerk={clerkJS as any}
      >
        <TaskChooseOrganization redirectUrlComplete="/dashboard" />
        <TaskResetPassword redirectUrlComplete="/account" />
        <TaskSetupMFA redirectUrlComplete="/secure" />
      </ClerkProvider>
    ));

    await vi.waitFor(() =>
      expect(members.mountTaskSetupMFA).toHaveBeenCalled()
    );
    expect(members.mountTaskChooseOrganization.mock.calls[0]![1]).toMatchObject(
      { redirectUrlComplete: '/dashboard' }
    );
    expect(members.mountTaskResetPassword.mock.calls[0]![1]).toMatchObject({
      redirectUrlComplete: '/account'
    });
    expect(members.mountTaskSetupMFA.mock.calls[0]![1]).toMatchObject({
      redirectUrlComplete: '/secure'
    });
    const [node] = members.mountTaskChooseOrganization.mock.calls[0]!;
    expect((node as HTMLElement).dataset.clerkComponent).toBe(
      'TaskChooseOrganization'
    );

    unmount();
    expect(members.unmountTaskChooseOrganization).toHaveBeenCalledWith(node);
    expect(members.unmountTaskResetPassword).toHaveBeenCalled();
    expect(members.unmountTaskSetupMFA).toHaveBeenCalled();
  });

  it('RedirectToTasks redirects once, with its props, after Clerk loads', async () => {
    const { clerkJS, members } = setup();
    render(() => (
      <ClerkProvider
        publishableKey={TEST_PUBLISHABLE_KEY}
        Clerk={clerkJS as any}
      >
        <RedirectToTasks redirectUrl="/after-tasks" />
      </ClerkProvider>
    ));

    await vi.waitFor(() =>
      expect(members.redirectToTasks).toHaveBeenCalledOnce()
    );
    expect(members.redirectToTasks).toHaveBeenCalledWith({
      redirectUrl: '/after-tasks'
    });
  });
});
