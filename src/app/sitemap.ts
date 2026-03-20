import type { MetadataRoute } from "next";
import { buildPlatformUrl, normalizePlatformWebsiteUrl } from "@/lib/platform-contact";

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = normalizePlatformWebsiteUrl(process.env.NEXT_PUBLIC_BASE_URL);

    return [
        {
            url: baseUrl,
            lastModified: new Date(),
            changeFrequency: "weekly",
            priority: 1,
        },
        {
            url: buildPlatformUrl(baseUrl, "/login"),
            lastModified: new Date(),
            changeFrequency: "monthly",
            priority: 0.8,
        },
        {
            url: buildPlatformUrl(baseUrl, "/signup"),
            lastModified: new Date(),
            changeFrequency: "monthly",
            priority: 0.8,
        },
        {
            url: buildPlatformUrl(baseUrl, "/privacy-policy"),
            lastModified: new Date(),
            changeFrequency: "monthly",
            priority: 0.3,
        },
        {
            url: buildPlatformUrl(baseUrl, "/terms"),
            lastModified: new Date(),
            changeFrequency: "monthly",
            priority: 0.3,
        },
    ];
}
