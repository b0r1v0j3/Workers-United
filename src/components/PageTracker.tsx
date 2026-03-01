"use client";

// ─── Global Page Tracker ────────────────────────────────────────────────────
// Automatically logs every page visit to user_activity.
// Added to layout.tsx — tracks URL, referrer, and time on page.

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { logActivity } from "@/lib/activityLogger";

export default function PageTracker() {
    const pathname = usePathname();
    const lastPath = useRef<string>("");
    const startTime = useRef<number>(Date.now());

    useEffect(() => {
        // Skip admin pages and static assets
        if (pathname?.startsWith("/admin")) return;
        if (pathname === lastPath.current) return;

        // Log time spent on previous page
        if (lastPath.current) {
            const timeSpent = Math.round((Date.now() - startTime.current) / 1000);
            if (timeSpent > 1) {
                logActivity("page_exit", "navigation", {
                    page: lastPath.current,
                    time_spent_seconds: timeSpent,
                });
            }
        }

        // Log new page visit
        logActivity("page_visit", "navigation", {
            page: pathname,
            referrer: typeof document !== "undefined" ? document.referrer : undefined,
        });

        lastPath.current = pathname || "";
        startTime.current = Date.now();
    }, [pathname]);

    return null; // Invisible tracking component
}
