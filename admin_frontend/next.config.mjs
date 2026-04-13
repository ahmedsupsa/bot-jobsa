/** @type {import('next').NextConfig} */
const backend = (
  process.env.ADMIN_API_ORIGIN ||
  process.env.NEXT_PUBLIC_ADMIN_API_ORIGIN ||
  "http://localhost:8080"
).replace(/\/$/, "");

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    if (!backend) {
      return [];
    }
    return [
      { source: "/api/:path*", destination: `${backend}/api/:path*` },
      { source: "/login", destination: `${backend}/login` },
      { source: "/logout", destination: `${backend}/logout` },
    ];
  },
};

export default nextConfig;
