/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: [
    "*.replit.dev",
    "*.repl.co",
    "*.replit.app",
    "*.janeway.replit.dev",
    "*.picard.replit.dev",
    "*.kirk.replit.dev",
    "*.pike.replit.dev",
  ],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(self)",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.resend.com https://api.tamara.co https://api.moyasar.com https://*.streampay.sa https://accounts.google.com",
              "frame-src 'self' https://checkout.tamara.co https://api.moyasar.com https://*.streampay.sa",
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
