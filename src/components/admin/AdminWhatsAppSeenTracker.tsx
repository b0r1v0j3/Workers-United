"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

interface AdminWhatsAppSeenTrackerProps {
    enabled: boolean;
    phoneNumber: string | null;
    latestAt: string | null;
    latestDirection: string;
}

export default function AdminWhatsAppSeenTracker({
    enabled,
    phoneNumber,
    latestAt,
    latestDirection,
}: AdminWhatsAppSeenTrackerProps) {
    const router = useRouter();
    const attemptedKeyRef = useRef<string | null>(null);
    const [, startTransition] = useTransition();

    useEffect(() => {
        if (!enabled || latestDirection !== "inbound" || !phoneNumber || !latestAt) {
            return;
        }

        const requestKey = `${phoneNumber}:${latestAt}:${latestDirection}`;
        if (attemptedKeyRef.current === requestKey) {
            return;
        }
        attemptedKeyRef.current = requestKey;

        const controller = new AbortController();
        let isCancelled = false;

        async function markSeen() {
            try {
                const response = await fetch("/api/admin/whatsapp-thread-view", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        phoneNumber,
                        latestAt,
                    }),
                    signal: controller.signal,
                });

                if (!response.ok) {
                    return;
                }

                const payload = await response.json() as {
                    success?: boolean;
                    changed?: boolean;
                };

                if (isCancelled || payload.success !== true || payload.changed !== true) {
                    return;
                }

                startTransition(() => {
                    router.refresh();
                });
            } catch (error) {
                if (error instanceof Error && error.name === "AbortError") {
                    return;
                }
            }
        }

        void markSeen();

        return () => {
            isCancelled = true;
            controller.abort();
        };
    }, [enabled, latestAt, latestDirection, phoneNumber, router, startTransition]);

    return null;
}
