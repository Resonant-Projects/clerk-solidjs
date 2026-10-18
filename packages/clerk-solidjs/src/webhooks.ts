/**
 * Verifies Clerk webhooks.
 *
 * @example
 * // src/routes/api/webhooks.ts
 * import type { APIEvent } from '@solidjs/start/server';
 * import { verifyWebhook } from '@resonant-projects/clerk-solidjs/webhooks';
 *
 * export async function POST({ request }: APIEvent) {
 *   const event = await verifyWebhook(request);
 *   // event.type, event.data
 *   return new Response(null, { status: 204 });
 * }
 */
export * from '@clerk/backend/webhooks';
