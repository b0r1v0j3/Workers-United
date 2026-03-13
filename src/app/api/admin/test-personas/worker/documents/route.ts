import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminTestSession } from "@/lib/admin-test-mode";
import { uploadAdminTestWorkerDocument } from "@/lib/admin-test-data";

const ALLOWED_DOCUMENT_TYPES = new Set(["passport", "biometric_photo", "diploma"]);

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const admin = createAdminClient();
        const session = await getAdminTestSession({ supabase, admin, ensurePersonas: true });

        if (!session.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!session.canUseAdminTestMode || session.activePersona?.role !== "worker" || !session.ownerProfile) {
            return NextResponse.json({ error: "Worker sandbox is not active." }, { status: 403 });
        }

        const formData = await request.formData();
        const docType = typeof formData.get("docType") === "string" ? String(formData.get("docType")) : "";
        const file = formData.get("file");

        if (!ALLOWED_DOCUMENT_TYPES.has(docType)) {
            return NextResponse.json({ error: "Unsupported document type." }, { status: 400 });
        }

        if (!(file instanceof File)) {
            return NextResponse.json({ error: "Document file is required." }, { status: 400 });
        }

        const document = await uploadAdminTestWorkerDocument({
            admin,
            personaId: session.activePersona.id,
            ownerProfileId: session.ownerProfile.id,
            docType,
            file,
        });

        return NextResponse.json({
            success: true,
            document,
            message: "Sandbox document uploaded and verified.",
        });
    } catch (error) {
        console.error("[AdminTestWorkerDocuments POST] Error:", error);
        return NextResponse.json({ error: "Failed to upload sandbox document." }, { status: 500 });
    }
}
