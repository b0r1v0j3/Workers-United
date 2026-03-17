export const WORKER_DOCUMENTS_BUCKET = "worker-docs";
export const REQUIRED_WORKER_DOCUMENT_TYPES = ["passport", "biometric_photo", "diploma"] as const;

type WorkerDocumentProgressRow = {
    document_type?: string | null;
    status?: string | null;
};

export function getWorkerDocumentProgress(documents: WorkerDocumentProgressRow[]) {
    const requiredTypes = new Set<string>(REQUIRED_WORKER_DOCUMENT_TYPES);
    const uploadedTypes = new Set<string>();
    const verifiedTypes = new Set<string>();
    const pendingTypes = new Set<string>();
    const rejectedTypes = new Set<string>();
    const statusesByType = new Map<string, Set<string>>();

    for (const document of documents || []) {
        const documentType = document.document_type?.trim();
        if (!documentType || !requiredTypes.has(documentType)) {
            continue;
        }

        uploadedTypes.add(documentType);
        const currentStatuses = statusesByType.get(documentType) || new Set<string>();
        currentStatuses.add((document.status || "uploaded").trim().toLowerCase());
        statusesByType.set(documentType, currentStatuses);
    }

    for (const documentType of uploadedTypes) {
        const statuses = statusesByType.get(documentType) || new Set<string>();

        if (statuses.has("verified")) {
            verifiedTypes.add(documentType);
        }

        if (statuses.has("rejected")) {
            rejectedTypes.add(documentType);
        }

        const hasPendingLikeStatus = Array.from(statuses).some((status) => status !== "verified" && status !== "rejected");
        if (hasPendingLikeStatus && !statuses.has("verified")) {
            pendingTypes.add(documentType);
        }
    }

    return {
        requiredCount: REQUIRED_WORKER_DOCUMENT_TYPES.length,
        uploadedCount: uploadedTypes.size,
        verifiedCount: verifiedTypes.size,
        pendingCount: pendingTypes.size,
        rejectedCount: rejectedTypes.size,
        uploadedTypes: Array.from(uploadedTypes),
        verifiedTypes: Array.from(verifiedTypes),
        pendingTypes: Array.from(pendingTypes),
        rejectedTypes: Array.from(rejectedTypes),
    };
}

export function getWorkerDocumentPublicUrl(storagePath: string | null | undefined): string | null {
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!baseUrl || !storagePath) {
        return null;
    }

    return `${baseUrl}/storage/v1/object/public/${WORKER_DOCUMENTS_BUCKET}/${storagePath}`;
}
