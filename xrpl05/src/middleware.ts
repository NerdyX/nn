import type { RequestHandler } from "@builder.io/qwik-city";

export const onRequest: RequestHandler = async ({ request, headers, next }) => {
  const url = new URL(request.url);

  // Your existing thumbnail/image caching logic — keep this untouched
  const isThumbnailRequest =
    url.pathname.startsWith("/api/nft/thumbnail/") ||
    (url.pathname.includes("/nft/") && url.searchParams.has("image")) ||
    url.search.includes("thumbnail=true") ||
    url.pathname.match(/\.(jpg|jpeg|png|gif|webp|avif)$/i);

  // Proceed to the route handler first
  const response = await next();

  // Apply thumbnail-specific headers only when applicable
  if (isThumbnailRequest) {
    // Aggressive public caching (Cloudflare edge respects this)
    response.headers.set(
      "Cache-Control",
      "public, max-age=604800, stale-while-revalidate=86400, stale-if-error=2592000",
    );

    // Security for images (already good)
    response.headers.set("X-Content-Type-Options", "nosniff");
    // Basic CSP for images — can be more permissive here if needed
    response.headers.set(
      "Content-Security-Policy",
      "default-src 'self'; img-src * data: blob:; connect-src 'self' https: wss:",
    );
  }

  // === Apply global security headers to ALL responses ===
  const globalHeaders = response.headers;

  // Enforce HTTPS & secure transport (1 year + preload)
  globalHeaders.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload",
  );

  // Prevent MIME sniffing
  globalHeaders.set("X-Content-Type-Options", "nosniff");

  // Block clickjacking
  globalHeaders.set("X-Frame-Options", "DENY");

  // Legacy XSS protection (older browsers)
  globalHeaders.set("X-XSS-Protection", "1; mode=block");

  // Referrer policy (balanced)
  globalHeaders.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permissions policy — disable unnecessary features
  globalHeaders.set(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=(), payment=(), usb=()",
  );

  // Content-Security-Policy — tuned for Qwik + Tailwind + your app
  globalHeaders.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      // Scripts: Qwik needs unsafe-eval for hydration; Tailwind may need unsafe-inline
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Styles: Tailwind often injects inline
      "style-src 'self' 'unsafe-inline'",
      // Connect: allow WebSockets to your RPCs + common APIs
      "connect-src 'self' https: wss: wss://xrplcluster.com wss://s1.ripple.com wss://xahau.network",
      // Images: self + common external (IPFS, CoinGecko if used)
      "img-src 'self' data: blob: https: https://ipfs.io https://cloudflare-ipfs.com https://*.coingecko.com",
      // Fonts (if using any external or data URIs)
      "font-src 'self' data:",
      // No frames/plugins
      "frame-ancestors 'none'",
      "object-src 'none'",
      // Upgrade HTTP to HTTPS automatically
      "upgrade-insecure-requests",
      // Optional: report violations to your /api/csp-report endpoint later
      // "report-uri /api/csp-report"
    ].join("; "),
  );

  // Optional: Remove or override any leaky headers (Cloudflare usually cleans Server)
  globalHeaders.delete("Server");

  return response;
};
