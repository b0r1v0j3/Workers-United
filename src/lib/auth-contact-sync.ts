import { createAdminClient } from "@/lib/supabase/admin";

export interface AuthContactSyncInput {
    userId: string;
    phone?: string | null;
    fullName?: string | null;
}

interface AuthUserSnapshot {
    phone?: string | null;
    phone_confirmed_at?: string | null;
    user_metadata?: Record<string, unknown> | null;
}

export interface AuthContactSyncPlan {
    normalizedPhone: string | null;
    nextMetadata: Record<string, unknown>;
    shouldUpdate: boolean;
    shouldSetPhone: boolean;
}

function normalizeMetadataValue(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }

    const trimmed = value.trim();
    return trimmed || null;
}

export function normalizeAuthContactPhone(phone: string | null | undefined): string | null {
    if (typeof phone !== "string") {
        return null;
    }

    const normalized = phone.replace(/[\s\-()]/g, "").trim();
    if (!normalized) {
        return null;
    }

    return /^\+\d{7,15}$/.test(normalized) ? normalized : null;
}

function normalizeStoredAuthPhone(phone: string | null | undefined): string | null {
    if (typeof phone !== "string") {
        return null;
    }

    const normalized = phone.replace(/[\s\-()+]/g, "").trim();
    if (!normalized) {
        return null;
    }

    return /^\d{7,15}$/.test(normalized) ? `+${normalized}` : null;
}

export function buildAuthContactSyncPlan(
    authUser: AuthUserSnapshot,
    input: AuthContactSyncInput
): AuthContactSyncPlan {
    const currentMetadata = authUser.user_metadata && typeof authUser.user_metadata === "object"
        ? { ...authUser.user_metadata }
        : {};

    const nextMetadata = { ...currentMetadata };
    const normalizedPhone = input.phone === undefined
        ? normalizeMetadataValue(currentMetadata.phone)
        : normalizeAuthContactPhone(input.phone);
    const normalizedFullName = input.fullName === undefined ? undefined : normalizeMetadataValue(input.fullName);

    let metadataChanged = false;

    if (input.phone !== undefined) {
        const currentMetadataPhone = normalizeMetadataValue(currentMetadata.phone);
        if (currentMetadataPhone !== normalizedPhone) {
            nextMetadata.phone = normalizedPhone;
            metadataChanged = true;
        }
    }

    if (input.fullName !== undefined) {
        const currentMetadataFullName = normalizeMetadataValue(currentMetadata.full_name);
        if (currentMetadataFullName !== normalizedFullName) {
            nextMetadata.full_name = normalizedFullName;
            metadataChanged = true;
        }
    }

    const currentPhone = normalizeStoredAuthPhone(authUser.phone);
    const shouldSetPhone = Boolean(normalizedPhone)
        && (currentPhone !== normalizedPhone || !authUser.phone_confirmed_at);

    return {
        normalizedPhone,
        nextMetadata,
        shouldUpdate: metadataChanged || shouldSetPhone,
        shouldSetPhone,
    };
}

export async function syncAuthContactFields(
    adminClient: ReturnType<typeof createAdminClient>,
    input: AuthContactSyncInput
) {
    const { data, error } = await adminClient.auth.admin.getUserById(input.userId);
    if (error) {
        throw error;
    }

    const authUser = data.user;
    if (!authUser) {
        throw new Error("Auth user not found.");
    }

    const plan = buildAuthContactSyncPlan(authUser, input);
    if (!plan.shouldUpdate) {
        return {
            ok: true,
            updated: false,
            normalizedPhone: plan.normalizedPhone,
        };
    }

    const updatePayload: {
        user_metadata: Record<string, unknown>;
        phone?: string;
        phone_confirm?: boolean;
    } = {
        user_metadata: plan.nextMetadata,
    };

    if (plan.shouldSetPhone && plan.normalizedPhone) {
        updatePayload.phone = plan.normalizedPhone;
        updatePayload.phone_confirm = true;
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(input.userId, updatePayload);
    if (updateError) {
        throw updateError;
    }

    return {
        ok: true,
        updated: true,
        normalizedPhone: plan.normalizedPhone,
    };
}
