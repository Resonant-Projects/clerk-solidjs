import { auth } from "@resonant-projects/clerk-solidjs/start/server";

// Accepts a session (a signed-in browser) or a Clerk API key
// (`Authorization: Bearer ak_...`).
export function GET() {
  const authObject = auth({ acceptsToken: ["session_token", "api_key"] });
  if (!authObject.isAuthenticated) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json({
    tokenType: authObject.tokenType,
    userId: authObject.tokenType === "session_token" ? authObject.userId : authObject.subject,
  });
}
