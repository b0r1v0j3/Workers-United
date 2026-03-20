import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGodModeUser } from "@/lib/godmode";
import { AGENCY_DRAFT_DOCUMENT_OWNER_KEY } from "@/lib/agency-draft-documents";
import { normalizePlatformWebsiteUrl } from "@/lib/platform-contact";

export const dynamic = "force-dynamic";

// POST: Re-trigger AI verification for a specific document
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Admin check
        const { data: profile } = await supabase
            .from("profiles")
            .select("user_type")
            .eq("id", user.id)
            .single();

        if (profile?.user_type !== "admin" && !isGodModeUser(user.email)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { documentId } = await request.json();

        if (!documentId) {
            return NextResponse.json({ error: "Missing documentId" }, { status: 400 });
        }

        const admin = createAdminClient();

        // Fetch the document
        const { data: doc, error: docErr } = await admin
            .from("worker_documents")
            .select("*")
            .eq("id", documentId)
            .single();

        if (!doc || docErr) {
            return NextResponse.json({ error: "Document not found" }, { status: 404 });
        }

        // Reset status to "verifying" so the worker sees it's being processed
        await admin
            .from("worker_documents")
            .update({
                status: "verifying",
                ocr_json: null,
                reject_reason: null,
                verified_at: null,
                updated_at: new Date().toISOString(),
            })
            .eq("id", documentId);

        if (!doc.storage_path) {
            return NextResponse.json({ error: "Document has no storage path" }, { status: 400 });
        }

        let verificationTargetId = doc.user_id;
        if (!verificationTargetId) {
            return NextResponse.json({ error: "Document has no worker target" }, { status: 400 });
        }

        const { data: draftWorker } = await admin
            .from("worker_onboarding")
            .select("id")
            .contains("application_data", { [AGENCY_DRAFT_DOCUMENT_OWNER_KEY]: doc.user_id })
            .maybeSingle();

        if (draftWorker?.id) {
            verificationTargetId = draftWorker.id;
        }

        // Call the existing verify-document endpoint internally
        const baseUrl = normalizePlatformWebsiteUrl(
            process.env.NEXT_PUBLIC_BASE_URL
            || process.env.NEXT_PUBLIC_APP_URL
            || process.env.VERCEL_URL
            || "http://localhost:3000"
        );

        const verifyRes = await fetch(`${baseUrl}/api/verify-document`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                // Forward cookies for auth
                Cookie: request.headers.get("cookie") || "",
            },
            body: JSON.stringify({
                workerId: verificationTargetId,
                docType: doc.document_type,
            }),
        });

        const verifyData = await verifyRes.json();

        if (!verifyRes.ok) {
            // Reset status back to pending on failure
            await admin
                .from("worker_documents")
                .update({
                    status: "pending",
                    reject_reason: `Re-verification failed: ${verifyData.error || "Unknown error"}`,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", documentId);

            return NextResponse.json(
                { error: verifyData.error || "Verification failed" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: verifyData.success !== false,
            status: verifyData.status || (verifyData.success === false ? "rejected" : "manual_review"),
            message: verifyData.message || "Re-verification complete",
            result: verifyData,
        });

    } catch (error) {
        console.error("[Re-Verify] System error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
