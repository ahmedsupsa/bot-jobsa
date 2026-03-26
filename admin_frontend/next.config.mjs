/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination:
          "https://admin-web-production-6395.up.railway.app/api/:path*",
      },
    ];
  },
};

export default nextConfig;
