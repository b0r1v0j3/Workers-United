import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
    try {
        const supabase = await createClient();

        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = user.id;

        // Gather all user data
        const exportData: Record<string, any> = {
            exported_at: new Date().toISOString(),
            account: {
                id: user.id,
                email: user.email,
                created_at: user.created_at,
                user_type: user.user_metadata?.user_type,
                gdpr_consent: user.user_metadata?.gdpr_consent,
                gdpr_consent_at: user.user_metadata?.gdpr_consent_at,
            },
        };

        // Profile data
        const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", userId)
            .single();

        if (profile) {
            exportData.profile = profile;
        }

        // Candidate data (workers)
        const { data: candidate } = await supabase
            .from("candidates")
            .select("*")
            .eq("profile_id", userId)
            .single();

        if (candidate) {
            exportData.candidate = candidate;
        }

        // Employer data
        const { data: employer } = await supabase
            .from("employers")
            .select("*")
            .eq("profile_id", userId)
            .single();

        if (employer) {
            exportData.employer = employer;
        }

        // Document metadata
        const { data: documents } = await supabase
            .from("candidate_documents")
            .select("*")
            .eq("user_id", userId);

        if (documents && documents.length > 0) {
            exportData.documents = documents.map(doc => ({
                ...doc,
                // Exclude actual file URLs for security, include metadata only
                file_url: "[available in your account]",
            }));
        }

        // Signatures
        const { data: signatures } = await supabase
            .from("signatures")
            .select("*")
            .eq("user_id", userId);

        if (signatures && signatures.length > 0) {
            exportData.signatures = signatures.map(sig => ({
                id: sig.id,
                created_at: sig.created_at,
                // Exclude actual signature data URL (base64 image)
                has_signature: true,
            }));
        }

        // Return as downloadable JSON
        const jsonString = JSON.stringify(exportData, null, 2);

        return new NextResponse(jsonString, {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Content-Disposition": `attachment; filename="workers-united-data-export-${new Date().toISOString().split('T')[0]}.json"`,
            },
        });

    } catch (error: any) {
        console.error("Data export error:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
