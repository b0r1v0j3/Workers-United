"use client";

import { useEffect, useState } from "react";
import { GodModePanel } from "./GodModePanel";

export function GodModeWrapper() {
    const [godModeData, setGodModeData] = useState<{
        godMode: boolean;
        email: string;
        role: "worker" | "employer" | "admin";
    } | null>(null);

    useEffect(() => {
        async function checkGodMode() {
            try {
                const response = await fetch("/api/godmode");
                const data = await response.json();

                if (data.godMode) {
                    // Get current role from profile
                    const profileResponse = await fetch("/api/profile");
                    const profileData = await profileResponse.json();

                    setGodModeData({
                        godMode: true,
                        email: data.email,
                        role: profileData.profile?.user_type || "worker"
                    });
                }
            } catch (error) {
                // Silently fail - user just won't see god mode
            }
        }

        checkGodMode();
    }, []);

    if (!godModeData?.godMode) return null;

    return (
        <GodModePanel
            currentRole={godModeData.role}
            userName={godModeData.email}
        />
    );
}
