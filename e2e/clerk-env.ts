export type ClerkE2EEnv = {
  publishableKey: string;
  secretKey: string;
};

export function getClerkE2EEnv(): ClerkE2EEnv {
  const publishableKey =
    process.env.VITE_CLERK_PUBLISHABLE_KEY ?? process.env.CLERK_PUBLISHABLE_KEY;
  const secretKey = process.env.CLERK_SECRET_KEY;

  if (!publishableKey) {
    throw new Error(
      "Missing Clerk publishable key. Set VITE_CLERK_PUBLISHABLE_KEY or CLERK_PUBLISHABLE_KEY.",
    );
  }

  if (!secretKey) {
    throw new Error("Missing Clerk secret key. Set CLERK_SECRET_KEY.");
  }

  return { publishableKey, secretKey };
}
