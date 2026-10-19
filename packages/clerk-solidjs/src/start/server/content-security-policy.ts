import { constants } from '@clerk/backend/internal';
import { getEnvVariable } from '../utils/env';

// Ported from @clerk/nextjs 7 (`src/server/content-security-policy.ts`).

const clerkProtectionOrigin = 'https://*.protect.clerk.com';
// A source with no port matches port 443 only, and these hosts are also
// requested on other ports.
const clerkProtectionConnectOrigin = `${clerkProtectionOrigin}:*`;

/** The CSP Level 3 directives. */
export type ContentSecurityPolicyDirective =
  | 'connect-src'
  | 'default-src'
  | 'font-src'
  | 'img-src'
  | 'media-src'
  | 'object-src'
  | 'script-src'
  | 'style-src'
  | 'base-uri'
  | 'child-src'
  | 'form-action'
  | 'frame-ancestors'
  | 'frame-src'
  | 'manifest-src'
  | 'navigate-to'
  | 'prefetch-src'
  | 'worker-src'
  | 'plugin-types'
  | 'require-sri-for'
  | 'sandbox'
  | 'block-all-mixed-content'
  | 'require-trusted-types-for'
  | 'trusted-types'
  | 'upgrade-insecure-requests'
  | 'report-to'
  | 'report-uri'
  | 'script-src-attr'
  | 'script-src-elem'
  | 'style-src-attr'
  | 'style-src-elem';

export interface ContentSecurityPolicyOptions {
  /**
   * Uses a per-request nonce and `'strict-dynamic'` in `script-src` instead
   * of allowing any `http:` and `https:` script. Pass the nonce to
   * SolidStart's `createHandler`, which adds it to its scripts:
   * `createHandler(() => <StartServer … />, (event) => ({ nonce: event.locals.clerkNonce }))`.
   */
  strict?: boolean;
  /** Directives to merge with Clerk's. `'none'` replaces a directive's sources. */
  directives?: Partial<Record<ContentSecurityPolicyDirective, string[]>>;
  /** Sends `Content-Security-Policy-Report-Only`, which reports violations without blocking. */
  reportOnly?: boolean;
  /**
   * Where browsers report violations, through `Reporting-Endpoints` and
   * `report-to csp-endpoint`, which replaces a `report-to` in `directives`.
   */
  reportTo?: string;
}

type DirectiveSet = Partial<Record<string, Set<string>>>;

/**
 * The keywords of a source list (`script-src`, `base-uri`, …): CSP3's
 * `keyword-source`, `'none'`, and the Speculation Rules spec's
 * `'inline-speculation-rules'`.
 */
const SOURCE_KEYWORDS = new Set([
  'inline-speculation-rules',
  'none',
  'report-sample',
  'report-sha256',
  'report-sha384',
  'report-sha512',
  'self',
  'strict-dynamic',
  'trusted-types-eval',
  'unsafe-allow-redirects',
  'unsafe-eval',
  'unsafe-hashes',
  'unsafe-inline',
  'unsafe-webtransport-hashes',
  'wasm-unsafe-eval'
]);

/**
 * The keywords of the directives that take something other than a source
 * list. Any other word there is a name (a trusted-types policy, a report-to
 * group) or a flag, and stays bare.
 */
const DIRECTIVE_KEYWORDS: Partial<Record<string, Set<string>>> = {
  'require-trusted-types-for': new Set(['script']),
  'trusted-types': new Set(['none', 'allow-duplicates'])
};

const isSourceList = (directive: string) =>
  /-src(-elem|-attr)?$/.test(directive) ||
  ['base-uri', 'form-action', 'frame-ancestors', 'navigate-to'].includes(
    directive
  );

const defaultDirectives = (): Record<string, string[]> => ({
  'connect-src': [
    'self',
    'https://clerk-telemetry.com',
    'https://*.clerk-telemetry.com',
    'https://api.stripe.com',
    'https://maps.googleapis.com',
    'https://img.clerk.com',
    clerkProtectionConnectOrigin
  ],
  'default-src': ['self'],
  'form-action': ['self'],
  'frame-src': [
    'self',
    'https://challenges.cloudflare.com',
    'https://*.js.stripe.com',
    'https://js.stripe.com',
    'https://hooks.stripe.com',
    clerkProtectionOrigin
  ],
  // Clerk's UI draws some images as data: SVGs (its theme, inputs and the
  // development-mode notice), which @clerk/nextjs's policy blocks.
  'img-src': ['self', 'https://img.clerk.com', 'data:'],
  'script-src': [
    'self',
    ...(getEnvVariable('NODE_ENV') !== 'production' ? ['unsafe-eval'] : []),
    'unsafe-inline',
    'https:',
    'http:',
    'https://*.js.stripe.com',
    'https://js.stripe.com',
    'https://maps.googleapis.com',
    clerkProtectionOrigin
  ],
  'style-src': ['self', 'unsafe-inline'],
  'worker-src': ['self', 'blob:']
});

/** Quotes the keywords (`self`, `none`, …), which CSP requires. */
const formatValue = (directive: string, value: string) => {
  const unquoted = value.replace(/^'|'$/g, '');
  // CSP matches a source list's keywords in any case. The names other
  // directives take are case-sensitive.
  if (isSourceList(directive)) {
    const keyword = unquoted.toLowerCase();
    return SOURCE_KEYWORDS.has(keyword) ? `'${keyword}'` : value;
  }
  return DIRECTIVE_KEYWORDS[directive]?.has(unquoted) ? `'${unquoted}'` : value;
};

const isNone = (directive: string, values: string[]) =>
  values.some((value) => formatValue(directive, value) === "'none'");

/** A random base64 nonce, new for each request. */
export const generateNonce = (): string => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''));
};

const buildDirectives = (
  strict: boolean,
  hosts: string[],
  custom: ContentSecurityPolicyOptions['directives'],
  nonce: string | undefined,
  reportTo: string | undefined
): string => {
  const directives: DirectiveSet = {};
  for (const [key, values] of Object.entries(defaultDirectives())) {
    directives[key] = new Set(values.map((value) => formatValue(key, value)));
  }

  for (const host of hosts) directives['connect-src']!.add(host);

  if (strict) {
    const scripts = directives['script-src']!;
    scripts.delete('http:');
    scripts.delete('https:');
    scripts.add("'strict-dynamic'");
    if (nonce) scripts.add(`'nonce-${nonce}'`);
  }

  for (const [key, raw] of Object.entries(custom ?? {})) {
    const values = Array.isArray(raw) ? raw : [raw as unknown as string];
    if (isNone(key, values)) {
      directives[key] = new Set(["'none'"]);
    } else if (directives[key]) {
      // Merged into Clerk's sources for a directive Clerk sets.
      values.forEach((value) => directives[key]!.add(formatValue(key, value)));
    } else {
      directives[key] = new Set(values.map((value) => formatValue(key, value)));
    }
  }

  // A policy takes one report-to group, and browsers ignore a second
  // report-to directive, so reportTo's group replaces one in `custom`.
  if (reportTo) directives['report-to'] = new Set(['csp-endpoint']);

  return Object.entries(directives)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, values]) => `${key} ${Array.from(values!).join(' ')}`)
    .join('; ');
};

/**
 * The Content-Security-Policy headers for Clerk, and the nonce in strict
 * mode. `hosts` are where the browser reaches the Frontend API: the
 * instance's host, and a proxy on another origin.
 *
 * @internal
 */
export const createContentSecurityPolicyHeaders = (
  hosts: string[],
  options: ContentSecurityPolicyOptions
): { headers: [string, string][]; nonce?: string } => {
  const headers: [string, string][] = [];
  const nonce = options.strict ? generateNonce() : undefined;

  const policy = buildDirectives(
    options.strict ?? false,
    hosts,
    options.directives,
    nonce,
    options.reportTo
  );

  if (options.reportTo) {
    headers.push([
      constants.Headers.ReportingEndpoints,
      `csp-endpoint="${options.reportTo}"`
    ]);
  }

  headers.push([
    options.reportOnly
      ? constants.Headers.ContentSecurityPolicyReportOnly
      : constants.Headers.ContentSecurityPolicy,
    policy
  ]);

  return { headers, nonce };
};
