import { MetadataRoute } from "next";
import { SPECIALIZATIONS } from "./wazaif/data";
import { GUIDES } from "./daleel/data";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://jobbots.org";
  const now = new Date();

  const static_pages: MetadataRoute.Sitemap = [
    { url: base, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/store`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/wazaif`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/daleel`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  const spec_pages: MetadataRoute.Sitemap = SPECIALIZATIONS.map((s) => ({
    url: `${base}/wazaif/${s.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const guide_pages: MetadataRoute.Sitemap = GUIDES.map((g) => ({
    url: `${base}/daleel/${g.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [...static_pages, ...spec_pages, ...guide_pages];
}
