/** @type {import('next').NextConfig} */
// عنوان خادم Flask (admin-web) فقط للسيرفر — يُقيَّم عند `next build` وعند التشغيل.
// على Railway: عيّن ADMIN_API_ORIGIN لخدمة الواجهة نفسها (نفس القيمة في Build وDeploy).
const backend = (
  process.env.ADMIN_API_ORIGIN ||
  process.env.NEXT_PUBLIC_ADMIN_API_ORIGIN ||
  ""
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
