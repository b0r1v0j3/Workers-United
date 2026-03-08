export const WORKER_DOCUMENTS_BUCKET = "worker-docs";

export function getWorkerDocumentPublicUrl(storagePath: string | null | undefined): string | null {
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!baseUrl || !storagePath) {
        return null;
    }

    return `${baseUrl}/storage/v1/object/public/${WORKER_DOCUMENTS_BUCKET}/${storagePath}`;
}
