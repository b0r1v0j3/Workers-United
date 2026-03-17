import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGodModeUser } from "@/lib/godmode";
import { WORKER_DOCUMENTS_BUCKET } from "@/lib/worker-documents";

export const dynamic = "force-dynamic";

interface RouteProps {
    params: Promise<{ documentId: string }>;
}

function getMimeType(fileName: string, fallback?: string | null) {
    if (fallback && fallback.trim().length > 0 && fallback !== "application/octet-stream") {
        return fallback;
    }

    const lower = fileName.toLowerCase();
    if (lower.endsWith(".pdf")) return "application/pdf";
    if (lower.endsWith(".png")) return "image/png";
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
    if (lower.endsWith(".webp")) return "image/webp";

    return "application/octet-stream";
}

function getInlineFileName(storagePath: string, documentType: string) {
    const fallback = `${documentType || "document"}`.replace(/[^a-zA-Z0-9._-]+/g, "_");
    const fileName = storagePath.split("/").pop() || fallback;
    return fileName.replace(/["\r\n]/g, "");
}

export async function GET(_request: Request, { params }: RouteProps) {
    const { documentId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .maybeSingle();

    if (profile?.user_type !== "admin" && !isGodModeUser(user.email)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = createAdminClient();
    const { data: document, error: documentError } = await admin
        .from("worker_documents")
        .select("storage_path, document_type")
        .eq("id", documentId)
        .maybeSingle();

    if (documentError || !document?.storage_path) {
        return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const { data: file, error: downloadError } = await admin.storage
        .from(WORKER_DOCUMENTS_BUCKET)
        .download(document.storage_path);

    if (downloadError || !file) {
        return NextResponse.json({ error: "Stored document not found" }, { status: 404 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = getInlineFileName(document.storage_path, document.document_type);

    return new NextResponse(buffer, {
        headers: {
            "Content-Type": getMimeType(fileName, file.type),
            "Content-Disposition": `inline; filename="${fileName}"`,
            "Cache-Control": "private, no-store, max-age=0",
            "X-Content-Type-Options": "nosniff",
        },
    });
}
