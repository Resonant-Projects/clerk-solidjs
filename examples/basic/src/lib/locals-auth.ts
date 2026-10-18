import type { SessionAuthObjectWithRedirect } from "@resonant-projects/clerk-solidjs/start/server";
import type { RequestEvent } from "solid-js/web";

// Checked by `pnpm type-check`: the reference in src/global.d.ts types
// `event.locals.auth` as the session auth object clerkMiddleware() sets. An
// untyped `any` would make this `boolean`, which fails the constraint.
type Expect<T extends true> = T;
export type LocalsAuthIsTyped = Expect<
  RequestEvent["locals"]["auth"] extends SessionAuthObjectWithRedirect
    ? true
    : false
>;
