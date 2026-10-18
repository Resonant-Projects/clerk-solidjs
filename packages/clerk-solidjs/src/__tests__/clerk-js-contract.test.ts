import type { Clerk as ClerkJS } from '@clerk/clerk-js';
import { expectTypeOf } from 'expect-type';
import { describe, test } from 'vitest';
import type { ClerkJSInternals } from '../types';

// IsomorphicClerk forwards to these clerk-js members, which the public Clerk
// interface does not declare. If clerk-js renames one (as Core 3 renamed
// __unstable__updateProps), `Pick` fails to type-check here.
type ForwardedMembers = Pick<ClerkJS, keyof ClerkJSInternals>;

describe('clerk-js contract', () => {
  test('clerk-js has every internal member IsomorphicClerk forwards to', () => {
    expectTypeOf<ForwardedMembers>().toMatchTypeOf<ClerkJSInternals>();
  });
});
