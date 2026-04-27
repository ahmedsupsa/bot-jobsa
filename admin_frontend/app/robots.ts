import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/store", "/privacy", "/terms"],
        disallow: ["/portal/", "/api/", "/admin/"],
      },
    ],
    sitemap: "https://jobbots.org/sitemap.xml",
    host: "https://jobbots.org",
  };
}
