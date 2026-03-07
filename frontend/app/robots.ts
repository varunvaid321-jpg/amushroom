import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/"],
    },
    sitemap: [
      "https://orangutany.com/sitemap.xml",
      "https://guide.orangutany.com/sitemap.xml",
    ],
  };
}
