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

/**
 * Headers as an object, with each Set-Cookie cut to its name: session
 * cookies are live credentials.
 */
export const redactHeaders = (headers: Headers) => {
  const result: Record<string, string | string[]> = {};
  headers.forEach((value, key) => {
    if (key !== 'set-cookie') result[key] = value;
  });
  const cookies = headers.getSetCookie?.() ?? [];
  if (cookies.length) {
    result['set-cookie'] = cookies.map((cookie) => `${cookie.split('=')[0]}=…`);
  }
  return result;
};
