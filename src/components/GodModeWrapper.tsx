"use client";

import { useEffect, useState } from "react";
import { GodModePanel } from "./GodModePanel";

interface PersonaPayload {
    id: string;
    role: "worker" | "employer" | "agency";
    label: string;
    href: string;
}

interface GodModePayload {
    available: boolean;
    email?: string | null;
    liveRole?: "worker" | "employer" | "agency" | "admin" | null;
    personas?: PersonaPayload[];
    activePersona?: PersonaPayload | null;
}

export function GodModeWrapper() {
    const [data, setData] = useState<GodModePayload | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function loadTestMode() {
            try {
                const response = await fetch("/api/admin/test-personas", { cache: "no-store" });
                const payload = await response.json();
                if (!cancelled) {
                    setData(payload);
                }
            } catch {
                if (!cancelled) {
                    setData(null);
                }
            }
        }

        void loadTestMode();
        return () => {
            cancelled = true;
        };
    }, []);

    if (!data?.available) {
        return null;
    }

    return (
        <GodModePanel
            currentRole={data.activePersona?.role || "admin"}
            userName={data.email || "Admin"}
            activeLabel={data.activePersona?.label || null}
            personas={data.personas || []}
        />
    );
}
