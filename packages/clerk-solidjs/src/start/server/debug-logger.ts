import type { ClerkRequest } from '@clerk/backend/internal';

type Entry = string | Record<string, unknown>;

/**
 * The last pass over every line logged, whatever it came from: the value of
 * any query parameter whose name, once decoded, starts with `__clerk` or
 * `__dev` (so `__cl%65rk_ticket` too), and anything shaped like a JWT, are
 * cut. The redactors below already log URLs without query values and
 * unknown headers by name only; this guards entries they do not shape.
 */
const scrub = (output: string) =>
  output
    .replace(
      /([?&;#\s<"']|^)([^=&#\s;,"'<>?]+)=([^&#\s;,"'<>\\]*)/gm,
      (match, separator: string, name: string) =>
        isClerkParam(safeDecode(name)) ? `${separator}${name}=…` : match
    )
    .replace(/eyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g, 'eyJ…');

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
          scrub(output)
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
 * Headers logged with their values, because they carry no credentials and
 * explain a request: what it asks for, where it comes from, and Clerk's
 * verdict. Every other header is logged by name only.
 */
const SAFE_HEADERS = new Set([
  'accept',
  'accept-language',
  'cache-control',
  'content-length',
  'content-type',
  'host',
  'origin',
  'sec-fetch-dest',
  'sec-fetch-mode',
  'sec-fetch-site',
  'user-agent',
  'vary',
  'x-forwarded-host',
  'x-forwarded-port',
  'x-forwarded-proto',
  'x-clerk-auth-message',
  'x-clerk-auth-reason',
  'x-clerk-auth-status'
]);

/** Headers whose value is a URL, logged without its query values. */
const URL_HEADERS = new Set(['content-location', 'location', 'referer']);

/**
 * A URL with every query value and the fragment cut: tokens travel in both
 * (handshake, dev-browser and sign-in tokens, and URLs nested in
 * `redirect_url`). Parameter names stay, so the log still says what was
 * sent. A path keeps the form it had.
 */
const redactUrlString = (value: string): string => {
  let url: URL;
  try {
    url = new URL(value, 'http://path');
  } catch {
    return '…';
  }
  const names = [...new Set(url.searchParams.keys())];
  const query = names.length
    ? `?${names.map((name) => `${encodeURIComponent(name)}=…`).join('&')}`
    : '';
  const path = `${url.pathname}${query}${url.hash ? '#…' : ''}`;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return `${url.origin}${path}`;
  return value.startsWith('//') ? `//${url.host}${path}` : path;
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
 * A header value fit to log: an allowlisted header as it is, a URL header
 * without query values, cookies by name, Authorization by a recognized scheme
 * (a bare token is cut whole), and anything else by name only.
 */
const redactHeaderValue = (key: string, value: string) => {
  if (key === 'cookie') return cookieNames(value);
  if (key === 'authorization' || key === 'proxy-authorization') {
    const scheme = /^(Basic|Bearer|Digest|Token)\s/i.exec(value)?.[1];
    return scheme ? `${scheme} …` : '…';
  }
  if (URL_HEADERS.has(key)) return redactUrlString(value);
  if (SAFE_HEADERS.has(key)) return value;
  return '…';
};

/**
 * Headers as an object, without credentials: each Set-Cookie by its name,
 * as session cookies are live credentials, and the other values as
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
 * headers as `redactHeaders` leaves them, cookies by name, and the URL
 * without query values. `toJSON()` itself includes them all.
 */
export const redactRequest = (request: ClerkRequest) => ({
  url: redactUrlString(request.clerkUrl.href),
  method: request.method,
  headers: redactHeaders(request.headers),
  cookies: [...request.cookies.keys()]
});
