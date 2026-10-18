import type { APIEvent } from "@solidjs/start/server";
import { verifyWebhook } from "@resonant-projects/clerk-solidjs/webhooks";

// Set CLERK_WEBHOOK_SIGNING_SECRET to the endpoint's signing secret from the Clerk
// Dashboard. Unsigned or forged requests are rejected.
export async function POST({ request }: APIEvent) {
  try {
    const event = await verifyWebhook(request);
    console.log(`Clerk webhook: ${event.type}`);
    return new Response(null, { status: 204 });
  } catch {
    return new Response("Invalid webhook signature", { status: 400 });
  }
}
