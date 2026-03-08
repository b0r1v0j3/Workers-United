export const CANONICAL_USER_TYPES = ["worker", "employer", "agency", "admin"] as const;

export type CanonicalUserType = (typeof CANONICAL_USER_TYPES)[number];

export const WORKER_DOMAIN = {
    table: "worker_onboarding",
    documentsTable: "worker_documents",
    storageBucket: "worker-docs",
} as const;

export function normalizeUserType(userType: string | null | undefined): CanonicalUserType | null {
    switch (userType) {
        case "worker":
            return "worker";
        case "employer":
            return "employer";
        case "agency":
            return "agency";
        case "admin":
            return "admin";
        default:
            return null;
    }
}

export function isWorkerUserType(userType: string | null | undefined): boolean {
    return normalizeUserType(userType) === "worker";
}

export function isAgencyUserType(userType: string | null | undefined): boolean {
    return normalizeUserType(userType) === "agency";
}

export function shouldProvisionWorkerRecords(userType: string | null | undefined): boolean {
    const normalized = normalizeUserType(userType);
    return normalized === null || normalized === "worker";
}
