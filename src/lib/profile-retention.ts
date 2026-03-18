const MS_PER_DAY = 1000 * 60 * 60 * 24;

export const PROFILE_INACTIVITY_DELETE_AFTER_DAYS = 90;
export const PROFILE_INACTIVITY_WARNING_DAYS_LEFT = [14, 7, 3] as const;
export const PROFILE_INACTIVITY_UI_ALERT_DAYS = 14;
export const PROFILE_RETENTION_CASE_EMAIL_TYPES = ["document_review_result", "admin_update"] as const;
export const PROFILE_RETENTION_ACTIVITY_CATEGORIES = ["profile", "documents", "payment", "auth", "messaging"] as const;

export interface ProfileRetentionSignals {
    authCreatedAt?: string | null;
    profileCreatedAt?: string | null;
    roleRecordCreatedAt?: string | null;
    roleRecordUpdatedAt?: string | null;
    latestDocumentAt?: string | null;
    latestSignatureAt?: string | null;
    latestCaseEmailAt?: string | null;
    latestUserActivityAt?: string | null;
    latestSupportAt?: string | null;
}

function parseTimestamp(value: string | null | undefined) {
    if (!value) {
        return null;
    }

    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : null;
}

export function pickLatestRetentionTimestamp(values: Array<string | null | undefined>) {
    let winner: string | null = null;
    let winnerTs = 0;

    for (const value of values) {
        const timestamp = parseTimestamp(value);
        if (timestamp && timestamp >= winnerTs) {
            winner = value || null;
            winnerTs = timestamp;
        }
    }

    return winner;
}

export function getProfileRetentionState(signals: ProfileRetentionSignals, now = new Date()) {
    const lastMeaningfulActivityAt = pickLatestRetentionTimestamp([
        signals.latestUserActivityAt,
        signals.latestCaseEmailAt,
        signals.latestDocumentAt,
        signals.latestSignatureAt,
        signals.latestSupportAt,
        signals.roleRecordUpdatedAt,
        signals.roleRecordCreatedAt,
        signals.profileCreatedAt,
        signals.authCreatedAt,
    ]);

    const lastActivityTs = parseTimestamp(lastMeaningfulActivityAt) || now.getTime();
    const elapsedDays = Math.max(0, Math.floor((now.getTime() - lastActivityTs) / MS_PER_DAY));
    const daysUntilDeletion = Math.max(0, PROFILE_INACTIVITY_DELETE_AFTER_DAYS - elapsedDays);
    const shouldDelete = elapsedDays >= PROFILE_INACTIVITY_DELETE_AFTER_DAYS;
    const isWarningDay = !shouldDelete && PROFILE_INACTIVITY_WARNING_DAYS_LEFT.includes(daysUntilDeletion as (typeof PROFILE_INACTIVITY_WARNING_DAYS_LEFT)[number]);
    const isNearDeletion = !shouldDelete && daysUntilDeletion <= PROFILE_INACTIVITY_UI_ALERT_DAYS;

    return {
        lastMeaningfulActivityAt,
        daysSinceLastMeaningfulActivity: elapsedDays,
        daysUntilDeletion,
        shouldDelete,
        isWarningDay,
        isNearDeletion,
    };
}
