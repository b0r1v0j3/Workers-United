import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ApplicationData } from "@/types/application";

export async function POST(request: Request) {
    try {
        const supabase = await createClient();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const applicationData: ApplicationData = await request.json();

        // Update candidate with application data
        const { error } = await supabase
            .from("candidates")
            .update({
                application_data: applicationData,
                updated_at: new Date().toISOString()
            })
            .eq("profile_id", user.id);

        if (error) {
            console.error("Error saving application data:", error);
            return NextResponse.json({ error: "Failed to save data" }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (err) {
        console.error("Application data API error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function GET() {
    try {
        const supabase = await createClient();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: candidate } = await supabase
            .from("candidates")
            .select("application_data")
            .eq("profile_id", user.id)
            .single();

        return NextResponse.json({
            success: true,
            data: candidate?.application_data || null
        });

    } catch (err) {
        console.error("Application data GET error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
