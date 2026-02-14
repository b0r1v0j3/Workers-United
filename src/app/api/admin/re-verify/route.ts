import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
            .select("role, user_type")
            .eq("id", user.id)
            .single();

        if (profile?.role !== "admin" && profile?.user_type !== "admin") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { documentId } = await request.json();

        if (!documentId) {
            return NextResponse.json({ error: "Missing documentId" }, { status: 400 });
        }

        const admin = createAdminClient();

        // Fetch the document
        const { data: doc, error: docErr } = await admin
            .from("candidate_documents")
            .select("*")
            .eq("id", documentId)
            .single();

        if (!doc || docErr) {
            return NextResponse.json({ error: "Document not found" }, { status: 404 });
        }

        // Reset status to "verifying" so the worker sees it's being processed
        await admin
            .from("candidate_documents")
            .update({
                status: "verifying",
                verification_result: null,
                admin_notes: "Re-verification triggered by admin",
                updated_at: new Date().toISOString(),
            })
            .eq("id", documentId);

        // Build the public URL for the document
        const storageUrl = doc.storage_path
            ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/candidate-docs/${doc.storage_path}`
            : null;

        if (!storageUrl) {
            return NextResponse.json({ error: "Document has no storage path" }, { status: 400 });
        }

        // Call the existing verify-document endpoint internally
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : "http://localhost:3000";

        const verifyRes = await fetch(`${baseUrl}/api/verify-document`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                // Forward cookies for auth
                Cookie: request.headers.get("cookie") || "",
            },
            body: JSON.stringify({
                documentId: doc.id,
                documentType: doc.document_type,
                imageUrl: storageUrl,
                userId: doc.user_id,
            }),
        });

        const verifyData = await verifyRes.json();

        if (!verifyRes.ok) {
            // Reset status back to pending on failure
            await admin
                .from("candidate_documents")
                .update({
                    status: "pending",
                    admin_notes: `Re-verification failed: ${verifyData.error || "Unknown error"}`,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", documentId);

            return NextResponse.json(
                { error: verifyData.error || "Verification failed" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Re-verification triggered successfully",
            result: verifyData,
        });

    } catch (error) {
        console.error("[Re-Verify] System error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
