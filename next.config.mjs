/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig = {
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },

  // IndexNow (Bing/Yandex) verifies its `keyLocation` strictly at the
  // domain root — see src/features/insights/seo/indexNow.ts for why.
  // This rewrites the exact literal path computed from INDEXNOW_KEY
  // (never a dynamic Next.js segment such as `/[key].txt`, which would
  // match every unmatched single-segment request at the site root and
  // break normal 404 handling for everything else) to the route that
  // actually serves the key. A no-op array when INDEXNOW_KEY isn't
  // configured, matching every other optional integration's "safe
  // without configuration" contract in this app.
  async rewrites() {
    const indexNowKey = process.env.INDEXNOW_KEY;
    if (!indexNowKey) return [];

    return [
      {
        source: `/${indexNowKey}.txt`,
        destination: "/api/indexnow-key",
      },
    ];
  },
};

export default nextConfig;
