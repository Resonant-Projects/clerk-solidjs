import { describe, expect, it } from 'vitest';
import * as stub from '../browser';
import * as server from '../index';

describe("./start/server's browser stub", () => {
  it('has every export the server entry has', () => {
    expect(Object.keys(stub).sort()).toEqual(Object.keys(server).sort());
  });

  it('throws where to call each server-only export instead', () => {
    for (const name of [
      'auth',
      'clerkClient',
      'clerkMiddleware',
      'createClerkClient',
      'verifyToken'
    ] as const) {
      expect(() => (stub[name] as () => unknown)()).toThrow(
        `Clerk: ${name}() from @resonant-projects/clerk-solidjs/start/server only runs on the server.`
      );
    }
  });

  it('keeps the reverification helpers, which run anywhere', () => {
    expect(stub.reverificationError).toBe(server.reverificationError);
    expect(stub.reverificationErrorResponse).toBe(
      server.reverificationErrorResponse
    );
  });
});
