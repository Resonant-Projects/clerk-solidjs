import type {
  SignInSignalValue,
  SignUpSignalValue,
  WaitlistSignalValue
} from '@clerk/shared/types';
import { cleanup, render, screen } from '@solidjs/testing-library';
import { expectTypeOf } from 'expect-type';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClerkProvider, useSignIn, useSignUp, useWaitlist } from '../..';
import {
  createFakeClerkJS,
  createFakeState,
  TEST_PUBLISHABLE_KEY
} from '../../__tests__/helpers/fake-clerk-js';
import * as legacy from '../../legacy';

/** A clerk-js resource keeps its state in private fields, like this one. */
class FakeSignInFuture {
  #status: string;
  passwordCalls: unknown[] = [];
  constructor(status = 'needs_first_factor') {
    this.#status = status;
  }
  get status() {
    return this.#status;
  }
  async password(params: unknown) {
    this.passwordCalls.push(params);
    this.#status = 'complete';
    return { error: null };
  }
}

/** A fake clerk-js whose load() waits for `finishLoading()`. */
const setup = (initial: Parameters<typeof createFakeState>[0] = {}) => {
  const fake = createFakeClerkJS();
  const signals = createFakeState(initial);
  let finishLoading!: () => void;
  const loading = new Promise<void>((resolve) => (finishLoading = resolve));
  fake.clerkJS.load.mockImplementation(async () => {
    await loading;
    fake.clerkJS.loaded = true;
  });
  Object.assign(fake.clerkJS, { __internal_state: signals.state });
  return { ...fake, signals, finishLoading };
};

const text = (testId: string) => screen.getByTestId(testId).textContent;

afterEach(() => {
  cleanup();
});

describe('useSignIn', () => {
  it("reads defaults before Clerk loads, then follows clerk-js's signal, when destructured", async () => {
    const future = new FakeSignInFuture();
    const { clerkJS, signals, finishLoading } = setup({ signIn: future });

    const Form = () => {
      const state = useSignIn();
      const { signIn, errors } = state;
      return (
        <>
          <p data-testid="status">{signIn.status}</p>
          <p data-testid="fetch">{state.fetchStatus}</p>
          <p data-testid="error">
            {errors.fields.identifier?.message ?? 'none'}
          </p>
        </>
      );
    };
    render(() => (
      <ClerkProvider
        publishableKey={TEST_PUBLISHABLE_KEY}
        Clerk={clerkJS as any}
      >
        <Form />
      </ClerkProvider>
    ));

    expect(text('status')).toBe('needs_identifier');
    expect(text('fetch')).toBe('idle');
    expect(text('error')).toBe('none');

    finishLoading();
    await vi.waitFor(() => expect(text('status')).toBe('needs_first_factor'));

    signals.set('signIn', {
      fetchStatus: 'fetching',
      errors: {
        fields: {
          identifier: { code: 'form_identifier_not_found', message: 'Nope' }
        },
        raw: [],
        global: null
      }
    });
    expect(text('fetch')).toBe('fetching');
    expect(text('error')).toBe('Nope');

    // clerk-js updates the resource in place and emits it again.
    await future.password({ password: 'secret' });
    signals.set('signIn', { fetchStatus: 'idle' });
    expect(text('status')).toBe('complete');
  });

  it("waits for Clerk to load, then calls the method on clerk-js's resource", async () => {
    const future = new FakeSignInFuture();
    const { clerkJS, finishLoading } = setup({ signIn: future });

    let signIn!: SignInSignalValue['signIn'];
    const Form = () => {
      ({ signIn } = useSignIn());
      return null;
    };
    render(() => (
      <ClerkProvider
        publishableKey={TEST_PUBLISHABLE_KEY}
        Clerk={clerkJS as any}
      >
        <Form />
      </ClerkProvider>
    ));

    const result = signIn.password({ password: 'secret' } as any);
    expect(future.passwordCalls).toEqual([]);

    finishLoading();
    await expect(result).resolves.toEqual({ error: null });
    expect(future.passwordCalls).toEqual([{ password: 'secret' }]);
    expect(signIn.status).toBe('complete');
  });

  it("uses the client's sign-in while clerk-js's signal has none", async () => {
    const future = new FakeSignInFuture('needs_second_factor');
    const { clerkJS, emit, finishLoading } = setup({ signIn: null });
    emit({ client: { signIn: { __internal_future: future } } as any });

    const Form = () => {
      const { signIn } = useSignIn();
      return <p data-testid="status">{signIn.status}</p>;
    };
    render(() => (
      <ClerkProvider
        publishableKey={TEST_PUBLISHABLE_KEY}
        Clerk={clerkJS as any}
      >
        <Form />
      </ClerkProvider>
    ));

    finishLoading();
    await vi.waitFor(() => expect(text('status')).toBe('needs_second_factor'));
  });

  it.each(['signal', 'client'] as const)(
    'waits for Clerk to load before completing passkey MFA through the %s resource',
    async (source) => {
      const mfa = { passkey: vi.fn(async () => ({ error: null })) };
      const future = {
        status: 'needs_second_factor',
        supportedSecondFactors: [{ strategy: 'passkey' }],
        mfa
      };
      const { clerkJS, emit, finishLoading } = setup({
        signIn: source === 'signal' ? future : null
      });
      if (source === 'client') {
        emit({ client: { signIn: { __internal_future: future } } as any });
      }

      let signIn!: SignInSignalValue['signIn'];
      const Form = () => {
        ({ signIn } = useSignIn());
        return null;
      };
      render(() => (
        <ClerkProvider
          publishableKey={TEST_PUBLISHABLE_KEY}
          Clerk={clerkJS as any}
        >
          <Form />
        </ClerkProvider>
      ));

      expect(signIn.supportedSecondFactors).toEqual([]);
      const result = signIn.mfa.passkey();
      expect(mfa.passkey).not.toHaveBeenCalled();

      finishLoading();
      await expect(result).resolves.toEqual({ error: null });
      expect(mfa.passkey).toHaveBeenCalledExactlyOnceWith();
      expect(mfa.passkey.mock.contexts[0]).toBe(mfa);
      expect(signIn.supportedSecondFactors).toEqual([{ strategy: 'passkey' }]);
    }
  );

  it("stops following clerk-js's signal when its owner is disposed", async () => {
    const { clerkJS, signals, finishLoading } = setup({
      signIn: new FakeSignInFuture()
    });

    const Form = () => {
      useSignIn();
      useSignUp();
      return null;
    };
    const { unmount } = render(() => (
      <ClerkProvider
        publishableKey={TEST_PUBLISHABLE_KEY}
        Clerk={clerkJS as any}
      >
        <Form />
      </ClerkProvider>
    ));
    finishLoading();
    await vi.waitFor(() => expect(signals.effects.size).toBe(2));

    unmount();
    expect(signals.effects.size).toBe(0);
  });
});

describe('when clerk-js fails to load', () => {
  it('rejects a method called before, and one called after', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const { clerkJS } = setup({ signIn: new FakeSignInFuture() });
    clerkJS.load.mockRejectedValue(new Error('blocked'));

    let signIn!: SignInSignalValue['signIn'];
    const Form = () => {
      ({ signIn } = useSignIn());
      return null;
    };
    render(() => (
      <ClerkProvider
        publishableKey={TEST_PUBLISHABLE_KEY}
        Clerk={clerkJS as any}
      >
        <Form />
      </ClerkProvider>
    ));

    const before = signIn.create({ identifier: 'a@example.com' });
    await expect(before).rejects.toMatchObject({
      code: 'clerk_js_failed_to_load'
    });
    await expect(
      signIn.create({ identifier: 'a@example.com' })
    ).rejects.toMatchObject({ code: 'clerk_js_failed_to_load' });
    consoleError.mockRestore();
  });
});

describe('useSignUp', () => {
  it("follows clerk-js's sign-up signal", async () => {
    // Not the stand-in's default, so the wait below sees clerk-js's value.
    const signUp = { status: 'abandoned' };
    const { clerkJS, signals, finishLoading } = setup({ signUp });

    const Form = () => {
      const state = useSignUp();
      return (
        <p data-testid="sign-up">
          {state.signUp.status} {state.fetchStatus}
        </p>
      );
    };
    render(() => (
      <ClerkProvider
        publishableKey={TEST_PUBLISHABLE_KEY}
        Clerk={clerkJS as any}
      >
        <Form />
      </ClerkProvider>
    ));

    finishLoading();
    await vi.waitFor(() => expect(text('sign-up')).toBe('abandoned idle'));
    signals.set('signUp', {
      signUp: { status: 'complete' },
      fetchStatus: 'fetching'
    });
    expect(text('sign-up')).toBe('complete fetching');
  });
});

describe('Slack workspace hint', () => {
  it('types slackTeamIdHint on the sign-in and sign-up methods that accept it', () => {
    type SignIn = SignInSignalValue['signIn'];
    type SignUp = SignUpSignalValue['signUp'];
    expectTypeOf<Parameters<SignIn['sso']>[0]>().toHaveProperty(
      'slackTeamIdHint'
    );
    expectTypeOf<Parameters<SignIn['create']>[0]>().toHaveProperty(
      'slackTeamIdHint'
    );
    expectTypeOf<Parameters<SignUp['sso']>[0]>().toHaveProperty(
      'slackTeamIdHint'
    );
    expectTypeOf<Parameters<SignUp['create']>[0]>().toHaveProperty(
      'slackTeamIdHint'
    );
  });

  it("passes the hint to clerk-js's sso() and create() unchanged once Clerk loads", async () => {
    const signInFuture = {
      sso: vi.fn(async () => ({ error: null })),
      create: vi.fn(async () => ({ error: null }))
    };
    const signUpFuture = {
      sso: vi.fn(async () => ({ error: null })),
      create: vi.fn(async () => ({ error: null }))
    };
    const { clerkJS, finishLoading } = setup({
      signIn: signInFuture,
      signUp: signUpFuture
    });

    let signIn!: SignInSignalValue['signIn'];
    let signUp!: SignUpSignalValue['signUp'];
    const Form = () => {
      ({ signIn } = useSignIn());
      ({ signUp } = useSignUp());
      return null;
    };
    render(() => (
      <ClerkProvider
        publishableKey={TEST_PUBLISHABLE_KEY}
        Clerk={clerkJS as any}
      >
        <Form />
      </ClerkProvider>
    ));

    const sso = {
      strategy: 'oauth_slack',
      redirectUrl: '/sso-callback',
      redirectCallbackUrl: '/sso-callback',
      slackTeamIdHint: 'T123ABC'
    } as const;
    const create = { strategy: 'oauth_slack', slackTeamIdHint: '' } as const;
    const results = [
      signIn.sso(sso),
      signIn.create(create),
      signUp.sso(sso),
      signUp.create(create)
    ];
    expect(signInFuture.sso).not.toHaveBeenCalled();

    finishLoading();
    await expect(Promise.all(results)).resolves.toHaveLength(4);
    expect(signInFuture.sso).toHaveBeenCalledExactlyOnceWith(sso);
    expect(signInFuture.create).toHaveBeenCalledExactlyOnceWith(create);
    expect(signUpFuture.sso).toHaveBeenCalledExactlyOnceWith(sso);
    expect(signUpFuture.create).toHaveBeenCalledExactlyOnceWith(create);
  });
});

describe('useWaitlist', () => {
  it("joins through clerk-js's waitlist once Clerk loads", async () => {
    const join = vi.fn(async () => ({ error: null }));
    const { clerkJS, finishLoading } = setup({ waitlist: { id: 'wl', join } });

    let waitlist!: WaitlistSignalValue['waitlist'];
    const Form = () => {
      ({ waitlist } = useWaitlist());
      return null;
    };
    render(() => (
      <ClerkProvider
        publishableKey={TEST_PUBLISHABLE_KEY}
        Clerk={clerkJS as any}
      >
        <Form />
      </ClerkProvider>
    ));

    expect(waitlist.id).toBe('');
    const joined = waitlist.join({ emailAddress: 'a@example.com' });
    finishLoading();
    await expect(joined).resolves.toEqual({ error: null });
    expect(join).toHaveBeenCalledWith({ emailAddress: 'a@example.com' });
    expect(waitlist.id).toBe('wl');
  });
});

describe('the legacy entry', () => {
  it('keeps the Core 2 useSignIn and useSignUp', async () => {
    const { clerkJS, emit, finishLoading } = setup();
    const signInResource = { status: 'needs_identifier' };
    emit({ client: { signIn: signInResource, signUp: {} } as any });

    let result!: ReturnType<typeof legacy.useSignIn>;
    const Form = () => {
      result = legacy.useSignIn();
      legacy.useSignUp();
      return null;
    };
    render(() => (
      <ClerkProvider
        publishableKey={TEST_PUBLISHABLE_KEY}
        Clerk={clerkJS as any}
      >
        <Form />
      </ClerkProvider>
    ));

    finishLoading();
    await vi.waitFor(() => expect(result.isLoaded()).toBe(true));
    expect(result.signIn()).toBe(signInResource);
    expect(typeof result.setActive).toBe('function');
  });
});
