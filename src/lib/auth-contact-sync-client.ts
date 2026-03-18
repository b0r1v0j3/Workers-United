export interface SyncCurrentUserAuthContactInput {
    phone?: string | null;
    fullName?: string | null;
}

export async function syncCurrentUserAuthContact(input: SyncCurrentUserAuthContactInput) {
    const response = await fetch("/api/profile/auth-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
        return {
            ok: false,
            error: typeof payload?.error === "string" ? payload.error : "Auth contact sync failed.",
        };
    }

    return {
        ok: true,
        updated: Boolean(payload?.updated),
        normalizedPhone: typeof payload?.normalizedPhone === "string" ? payload.normalizedPhone : null,
    };
}
