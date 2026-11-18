import type { ClerkClient } from '@clerk/backend';

/**
 * Poppy (Personal Agent Protocol) discovery, ported from `clerkMiddleware()`
 * in @clerk/nextjs 7.10.0. Clerk marks `poppy` a preview while the protocol
 * is a draft, so this follows Next.js and may change with it.
 */

const POPPY_JSON_PATH = '/.well-known/poppy.json';
const PROTECTED_RESOURCE_PATH = '/.well-known/oauth-protected-resource';

/** Whether the URL is one of the two discovery documents Poppy publishes. */
export const isPoppyDiscoveryPath = (url: URL) =>
  url.pathname === POPPY_JSON_PATH || url.pathname === PROTECTED_RESOURCE_PATH;

/** The parts of the Backend API's Poppy artifact the protected-resource document reads. */
type PoppyMetadata = {
  organization: { domain: string };
  auth: { issuer: string; scopes: Record<string, unknown> };
};

/**
 * Serves a discovery document from the Backend API's Poppy artifact.
 * `/.well-known/poppy.json` is the artifact as it is;
 * `/.well-known/oauth-protected-resource` is the OAuth protected resource
 * metadata built from it. Only GET is allowed, and an artifact the Backend
 * API fails to return rejects rather than serving a made-up document.
 */
export const poppyDiscoveryResponse = async (
  request: Request,
  url: URL,
  client: Pick<ClerkClient, 'artifacts'>
): Promise<Response> => {
  if (request.method !== 'GET') {
    return new Response(null, { status: 405, headers: { Allow: 'GET' } });
  }
  const metadata = await client.artifacts.getPoppyJson();
  const headers = { 'Cache-Control': 'no-store' };
  if (url.pathname === POPPY_JSON_PATH) {
    return Response.json(metadata, { headers });
  }
  const { organization, auth } = metadata as PoppyMetadata;
  return Response.json(
    {
      resource: `https://${organization.domain}`,
      authorization_servers: [auth.issuer],
      scopes_supported: Object.keys(auth.scopes),
      bearer_methods_supported: ['header']
    },
    { headers }
  );
};
