// src/routes/auth/xaman/callback/index.ts
import type { RequestHandler } from "@builder.io/qwik-city";
import { z } from "zod";

const envSchema = z.object({
  XAMAN_CLIENT_ID: z.string().min(1),
  XAMAN_CLIENT_SECRET: z.string().min(1),
  PUBLIC_ORIGIN: z.string().url().default("http://localhost:5173"),
});

export const onGet: RequestHandler = async ({ url, cookie, env, redirect }) => {
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    console.error("Xaman OAuth error:", error);
    throw redirect(302, "/?error=oauth_failed");
  }

  if (!code) {
    throw redirect(302, "/?error=no_code");
  }

  const parsedEnv = envSchema.safeParse({
    XAMAN_CLIENT_ID: env.get("XAMAN_CLIENT_ID"),
    XAMAN_CLIENT_SECRET: env.get("XAMAN_CLIENT_SECRET"),
    PUBLIC_ORIGIN: env.get("PUBLIC_ORIGIN"),
  });

  if (!parsedEnv.success) {
    console.error(
      "Missing Xaman env vars in callback:",
      parsedEnv.error.format(),
    );
    throw redirect(302, "/?error=configuration");
  }

  const { XAMAN_CLIENT_ID, XAMAN_CLIENT_SECRET, PUBLIC_ORIGIN } =
    parsedEnv.data;
  const redirectUri = `${PUBLIC_ORIGIN}/auth/xaman/callback`;

  try {
    const tokenResponse = await fetch("https://oauth2.xaman.app/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " + btoa(`${XAMAN_CLIENT_ID}:${XAMAN_CLIENT_SECRET}`),
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token exchange failed:", errorText);
      throw new Error("Token exchange failed");
    }

    const tokens = await tokenResponse.json();

    // Store access_token (JWT) in httpOnly cookie
    cookie.set("xaman_jwt", tokens.access_token, {
      path: "/",
      httpOnly: true,
      secure: import.meta.env.PROD || process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 hours – matches Xaman JWT lifetime
    });

    // Optional: You could also store refresh_token if you plan to implement refresh

    // Redirect to dashboard or home after successful login
    throw redirect(302, "/dashboard");
  } catch (err) {
    console.error("Callback error:", err);
    throw redirect(302, "/?error=login_failed");
  }
};
