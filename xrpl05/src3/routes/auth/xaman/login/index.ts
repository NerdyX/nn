// src/routes/auth/xaman/login/index.ts
import type { RequestHandler } from "@builder.io/qwik-city";
import { z } from "zod";

// Optional: Simple schema for env vars (helps catch missing config early)
const envSchema = z.object({
  XAMAN_CLIENT_ID: z.string().min(1),
  PUBLIC_ORIGIN: z.string().url().default("http://localhost:5173"),
});

export const onGet: RequestHandler = async ({ env, redirect }) => {
  // Validate env vars (will throw if missing in dev)
  const parsedEnv = envSchema.safeParse({
    XAMAN_CLIENT_ID: env.get("XAMAN_CLIENT_ID"),
    PUBLIC_ORIGIN: env.get("PUBLIC_ORIGIN"),
  });

  if (!parsedEnv.success) {
    console.error("Missing Xaman env vars:", parsedEnv.error.format());
    throw redirect(302, "/?error=configuration");
  }

  const { XAMAN_CLIENT_ID, PUBLIC_ORIGIN } = parsedEnv.data;

  const redirectUri = `${PUBLIC_ORIGIN}/auth/xaman/callback`;

  const authUrl = new URL("https://oauth2.xaman.app/auth");

  authUrl.searchParams.set("client_id", XAMAN_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid profile"); // add more scopes if needed later

  // Optional: Add state param for CSRF protection (recommended)
  // You can generate a random state, store in cookie/session, verify in callback
  // For simplicity we're skipping it here – add if security is a concern

  throw redirect(302, authUrl.toString());
};
