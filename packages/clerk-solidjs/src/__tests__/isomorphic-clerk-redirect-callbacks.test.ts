import { describe, expect, it, vi } from 'vitest';
import { IsomorphicClerk } from '../isomorphic-clerk';

/** A promise and the functions that settle it. */
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

/** Whether a promise has settled, after pending microtasks run. */
const isSettled = async (promise: Promise<unknown>) => {
  let settled = false;
  promise.then(
    () => (settled = true),
    () => (settled = true)
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  return settled;
};

const createClerkJS = () => {
  const clerkJS = {
    loaded: false,
    load: vi.fn(async () => {
      clerkJS.loaded = true;
    }),
    addListener: vi.fn(),
    handleRedirectCallback: vi.fn<(...args: unknown[]) => Promise<unknown>>(
      async () => undefined
    ),
    handleGoogleOneTapCallback: vi.fn<(...args: unknown[]) => Promise<unknown>>(
      async () => undefined
    )
  };
  return clerkJS;
};

/** An IsomorphicClerk whose clerk-js finishes loading when `load()` is called. */
const createIsomorphicClerk = () => {
  const clerkJS = createClerkJS();
  const loading = deferred<void>();
  clerkJS.load.mockImplementationOnce(async () => {
    await loading.promise;
    clerkJS.loaded = true;
  });
  const isomorphicClerk = new IsomorphicClerk({
    publishableKey: 'pk_test_XXX',
    Clerk: clerkJS as any
  });
  const load = async () => {
    loading.resolve();
    await vi.waitFor(() => expect(isomorphicClerk.loaded).toBe(true));
  };
  return { clerkJS, isomorphicClerk, load };
};

const loadedClerk = async () => {
  const clerkJS = createClerkJS();
  const isomorphicClerk = new IsomorphicClerk({
    publishableKey: 'pk_test_XXX',
    Clerk: clerkJS as any
  });
  await vi.waitFor(() => expect(isomorphicClerk.loaded).toBe(true));
  return { clerkJS, isomorphicClerk };
};

const params = { signInUrl: '/sign-in' };
const signIn = { object: 'sign_in' } as any;

describe('IsomorphicClerk handleRedirectCallback', () => {
  it("resolves only once clerk-js's promise does, with its value", async () => {
    const { clerkJS, isomorphicClerk } = await loadedClerk();
    const result = deferred<unknown>();
    clerkJS.handleRedirectCallback.mockReturnValueOnce(result.promise);

    const call = isomorphicClerk.handleRedirectCallback(params);

    expect(await isSettled(call)).toBe(false);
    result.resolve('done');
    await expect(call).resolves.toBe('done');
  });

  it("rejects with clerk-js's error", async () => {
    const { clerkJS, isomorphicClerk } = await loadedClerk();
    const error = new Error('callback failed');
    clerkJS.handleRedirectCallback.mockRejectedValueOnce(error);

    await expect(isomorphicClerk.handleRedirectCallback(params)).rejects.toBe(
      error
    );
  });

  it('passes customNavigate to clerk-js', async () => {
    const { clerkJS, isomorphicClerk } = await loadedClerk();
    const customNavigate = vi.fn(async () => {});

    await isomorphicClerk.handleRedirectCallback(params, customNavigate);

    expect(clerkJS.handleRedirectCallback).toHaveBeenCalledExactlyOnceWith(
      params,
      customNavigate
    );
  });

  it('shares one clerk-js call between concurrent calls', async () => {
    const { clerkJS, isomorphicClerk } = await loadedClerk();
    const result = deferred<unknown>();
    clerkJS.handleRedirectCallback.mockReturnValueOnce(result.promise);

    const first = isomorphicClerk.handleRedirectCallback(params);
    const second = isomorphicClerk.handleRedirectCallback(params);
    result.resolve('done');

    await expect(first).resolves.toBe('done');
    await expect(second).resolves.toBe('done');
    expect(clerkJS.handleRedirectCallback).toHaveBeenCalledOnce();
  });

  it('calls clerk-js again once the shared call has settled', async () => {
    const { clerkJS, isomorphicClerk } = await loadedClerk();
    clerkJS.handleRedirectCallback.mockRejectedValueOnce(new Error('first'));

    await expect(
      isomorphicClerk.handleRedirectCallback(params)
    ).rejects.toThrow('first');
    await isomorphicClerk.handleRedirectCallback(params);

    expect(clerkJS.handleRedirectCallback).toHaveBeenCalledTimes(2);
  });

  it('waits for clerk-js to load, then resolves with its value', async () => {
    const { clerkJS, isomorphicClerk, load } = createIsomorphicClerk();
    clerkJS.handleRedirectCallback.mockResolvedValueOnce('done');
    const customNavigate = vi.fn(async () => {});

    const call = isomorphicClerk.handleRedirectCallback(params, customNavigate);

    expect(await isSettled(call)).toBe(false);
    expect(clerkJS.handleRedirectCallback).not.toHaveBeenCalled();
    await load();
    await expect(call).resolves.toBe('done');
    expect(clerkJS.handleRedirectCallback).toHaveBeenCalledExactlyOnceWith(
      params,
      customNavigate
    );
  });
});

describe('IsomorphicClerk handleGoogleOneTapCallback', () => {
  it("resolves only once clerk-js's promise does, with its value", async () => {
    const { clerkJS, isomorphicClerk } = await loadedClerk();
    const result = deferred<unknown>();
    clerkJS.handleGoogleOneTapCallback.mockReturnValueOnce(result.promise);

    const call = isomorphicClerk.handleGoogleOneTapCallback(signIn, params);

    expect(await isSettled(call)).toBe(false);
    result.resolve('done');
    await expect(call).resolves.toBe('done');
  });

  it("rejects with clerk-js's error", async () => {
    const { clerkJS, isomorphicClerk } = await loadedClerk();
    const error = new Error('one tap failed');
    clerkJS.handleGoogleOneTapCallback.mockRejectedValueOnce(error);

    await expect(
      isomorphicClerk.handleGoogleOneTapCallback(signIn, params)
    ).rejects.toBe(error);
  });

  it('passes customNavigate to clerk-js', async () => {
    const { clerkJS, isomorphicClerk } = await loadedClerk();
    const customNavigate = vi.fn(async () => {});

    await isomorphicClerk.handleGoogleOneTapCallback(
      signIn,
      params,
      customNavigate
    );

    expect(clerkJS.handleGoogleOneTapCallback).toHaveBeenCalledExactlyOnceWith(
      signIn,
      params,
      customNavigate
    );
  });

  it('waits for clerk-js to load, then resolves with its value', async () => {
    const { clerkJS, isomorphicClerk, load } = createIsomorphicClerk();
    clerkJS.handleGoogleOneTapCallback.mockResolvedValueOnce('done');

    const call = isomorphicClerk.handleGoogleOneTapCallback(signIn, params);

    expect(await isSettled(call)).toBe(false);
    expect(clerkJS.handleGoogleOneTapCallback).not.toHaveBeenCalled();
    await load();
    await expect(call).resolves.toBe('done');
    expect(clerkJS.handleGoogleOneTapCallback).toHaveBeenCalledOnce();
  });
});

// emitLoaded() runs listeners from an array it clears only afterwards, so a
// handler that queued another listener once loaded re-ran the caller's own.
describe('IsomorphicClerk callbacks called from a loaded listener', () => {
  it('handleRedirectCallback calls clerk-js once', async () => {
    const { clerkJS, isomorphicClerk } = await loadedClerk();
    clerkJS.handleRedirectCallback.mockResolvedValue('done');
    let call: Promise<unknown> | undefined;

    isomorphicClerk.addOnLoaded(() => {
      call = isomorphicClerk.handleRedirectCallback(params);
    });

    await expect(call).resolves.toBe('done');
    expect(clerkJS.handleRedirectCallback).toHaveBeenCalledOnce();
  });

  it('handleGoogleOneTapCallback calls clerk-js once', async () => {
    const { clerkJS, isomorphicClerk } = await loadedClerk();
    clerkJS.handleGoogleOneTapCallback.mockResolvedValue('done');
    let call: Promise<unknown> | undefined;

    isomorphicClerk.addOnLoaded(() => {
      call = isomorphicClerk.handleGoogleOneTapCallback(signIn, params);
    });

    await expect(call).resolves.toBe('done');
    expect(clerkJS.handleGoogleOneTapCallback).toHaveBeenCalledOnce();
  });
});
