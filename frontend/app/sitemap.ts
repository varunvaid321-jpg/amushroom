import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://orangutany.com",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: "https://orangutany.com/about",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: "https://orangutany.com/privacy",
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: "https://orangutany.com/terms",
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: "https://orangutany.com/refund",
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
