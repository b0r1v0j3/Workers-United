import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Check authentication
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { signatureData, documentType, agreedText } = body;

        if (!signatureData || !documentType) {
            return NextResponse.json(
                { error: "Missing required fields: signatureData, documentType" },
                { status: 400 }
            );
        }

        // Get client info
        const ip = request.headers.get("x-forwarded-for") ||
            request.headers.get("x-real-ip") ||
            "unknown";
        const userAgent = request.headers.get("user-agent") || "unknown";

        // Store signature in database
        const { data, error } = await supabase
            .from("signatures")
            .insert({
                user_id: user.id,
                signature_data: signatureData,
                document_type: documentType,
                ip_address: ip,
                user_agent: userAgent,
                agreed_text: agreedText || "Digital signature consent for employment applications"
            })
            .select()
            .single();

        if (error) {
            console.error("Signature save error:", error);
            return NextResponse.json({ error: "Failed to save signature" }, { status: 500 });
        }

        // Update candidate signature URL
        await supabase
            .from("candidates")
            .update({
                signature_url: data.id, // Reference to signature
                signature_agreed_at: new Date().toISOString()
            })
            .eq("profile_id", user.id);

        return NextResponse.json({
            success: true,
            signatureId: data.id,
            message: "Signature saved successfully"
        });

    } catch (error) {
        console.error("Signature API error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: signatures } = await supabase
            .from("signatures")
            .select("id, document_type, agreed_at, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

        return NextResponse.json({ signatures: signatures || [] });

    } catch (error) {
        console.error("Signature GET error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
