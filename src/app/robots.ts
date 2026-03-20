import type { MetadataRoute } from "next";
import { buildPlatformUrl, normalizePlatformWebsiteUrl } from "@/lib/platform-contact";

export default function robots(): MetadataRoute.Robots {
    const baseUrl = normalizePlatformWebsiteUrl(process.env.NEXT_PUBLIC_BASE_URL);
    return {
        rules: [
            {
                userAgent: "*",
                allow: "/",
                disallow: [
                    "/api/",
                    "/admin/",
                    "/profile/",
                    "/auth/",
                ],
            },
        ],
        sitemap: buildPlatformUrl(baseUrl, "/sitemap.xml"),
    };
}
