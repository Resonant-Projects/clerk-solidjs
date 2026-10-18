import type { ClerkRequest } from '@clerk/backend/internal';

type Entry = string | Record<string, unknown>;

/**
 * Collects a request's debug entries and logs them together, between a
 * start and an end line, as `@clerk/nextjs`'s debug logger does. Entries are
 * computed only when enabled.
 *
 * @internal
 */
export const createDebugLogger = (name: string, enabled: boolean) => {
  const entries: Entry[][] = [];
  return {
    debug: (...args: Array<Entry | (() => Entry)>) => {
      if (!enabled) return;
      entries.push(
        args.map((arg) => (typeof arg === 'function' ? arg() : arg))
      );
    },
    commit: () => {
      if (!enabled) return;
      console.log(`[clerk debug start: ${name}]`);
      for (const entry of entries) {
        const output = entry
          .map((part) =>
            typeof part === 'string' ? part : JSON.stringify(part, null, 2)
          )
          .join(' ');
        // One call per entry, so hosts that cap a log line's size (Vercel and
        // Netlify at 4 KB) keep the rest.
        console.log(
          output
            .split('\n')
            .map((line) => `  ${line}`)
            .join('\n')
        );
      }
      console.log(
        `[clerk debug end: ${name}] (${PACKAGE_NAME}=${PACKAGE_VERSION},timestamp=${Math.round(Date.now() / 1_000)})`
      );
    }
  };
};

/** The first seven characters, as `@clerk/backend` shortens keys and tokens. */
export const shorten = (value: unknown) =>
  typeof value === 'string' && value ? `${value.substring(0, 7)}…` : value;

const SECRET_OPTIONS = ['secretKey', 'machineSecretKey', 'jwtKey'] as const;

/** Options with the keys shortened. */
export const redactOptions = (options: Record<string, unknown>) => {
  const redacted = { ...options };
  for (const key of SECRET_OPTIONS) {
    if (key in redacted) redacted[key] = shorten(redacted[key]);
  }
  return redacted;
};

const safeDecode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const isClerkParam = (name: string) =>
  name.startsWith('__clerk') || name.startsWith('__dev');

/**
 * A URL with the values of Clerk's own query parameters (`__clerk_*` and
 * `__dev_*`) cut out, in it and in any URL it carries as a parameter (a
 * handshake's `redirect_url`): they carry handshake, dev-browser and
 * sign-in tokens. A fragment that mentions them is cut too.
 */
const redactUrlString = (value: string): string => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return value;
  }
  for (const [name, param] of [...url.searchParams]) {
    if (isClerkParam(name)) {
      url.searchParams.set(name, '…');
    } else if (/^https?:\/\//i.test(param)) {
      url.searchParams.set(name, redactUrlString(param));
    }
  }
  if (/__clerk|__dev/.test(safeDecode(url.hash))) url.hash = '…';
  return url.toString();
};

/** Names only, from a Cookie header. */
const cookieNames = (cookie: string) =>
  cookie
    .split(';')
    .map((part) => part.trim().split('=')[0])
    .filter(Boolean)
    .map((name) => `${name}=…`)
    .join('; ');

/**
 * A header value fit to log. Credentials are cut to what identifies them
 * (an Authorization scheme, cookie names), and any URL, absolute or a path
 * (Location, Referer, x-forwarded-uri and the like), loses Clerk's tokens:
 * a same-origin Referer keeps the query, which can carry `__clerk_ticket`.
 */
const redactHeaderValue = (key: string, value: string) => {
  if (key === 'cookie') return cookieNames(value);
  if (key === 'authorization' || key === 'proxy-authorization') {
    return `${value.split(' ')[0]} …`;
  }
  if (/^https?:\/\//i.test(value)) return redactUrlString(value);
  // Parsed, not matched as text: a name can be percent-encoded
  // (`%5F%5Fclerk_ticket`), and URLSearchParams decodes it.
  if (value.startsWith('/') && !value.startsWith('//')) {
    const url = new URL(redactUrlString(new URL(value, 'http://path').href));
    return `${url.pathname}${url.search}${url.hash}`;
  }
  return value;
};

/**
 * Headers as an object, without credentials: each Set-Cookie cut to its
 * name, as session cookies are live credentials, and the other values as
 * `redactHeaderValue` leaves them.
 */
export const redactHeaders = (headers: Headers) => {
  const result: Record<string, string | string[]> = {};
  headers.forEach((value, key) => {
    if (key !== 'set-cookie') result[key] = redactHeaderValue(key, value);
  });
  const cookies = headers.getSetCookie?.() ?? [];
  if (cookies.length) {
    result['set-cookie'] = cookies.map((cookie) => `${cookie.split('=')[0]}=…`);
  }
  return result;
};

/**
 * The request as `ClerkRequest.toJSON()` describes it, without credentials:
 * headers as `redactHeaders` leaves them, cookies by name, and Clerk's
 * tokens cut out of the URL. `toJSON()` itself includes them all.
 */
export const redactRequest = (request: ClerkRequest) => ({
  url: redactUrlString(request.clerkUrl.href),
  method: request.method,
  headers: redactHeaders(request.headers),
  cookies: [...request.cookies.keys()]
});
