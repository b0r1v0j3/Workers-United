import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isGodModeUser } from "@/lib/godmode";

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Check god mode access
        if (!isGodModeUser(user.email)) {
            return NextResponse.json({ error: "God mode not available" }, { status: 403 });
        }

        const body = await request.json();
        const { action } = body;

        switch (action) {
            case "verify":
                // Skip to verified status
                await supabase
                    .from("candidates")
                    .update({
                        status: "VERIFIED",
                        updated_at: new Date().toISOString()
                    })
                    .eq("profile_id", user.id);
                break;

            case "queue":
                // Skip to in queue status
                const nextPos = await getNextQueuePosition(supabase);
                await supabase
                    .from("candidates")
                    .update({
                        status: "IN_QUEUE",
                        entry_fee_paid: true,
                        queue_position: nextPos,
                        queue_joined_at: new Date().toISOString(),
                        refund_deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq("profile_id", user.id);
                break;

            case "offer":
                // Skip to offer pending
                await supabase
                    .from("candidates")
                    .update({
                        status: "OFFER_PENDING",
                        updated_at: new Date().toISOString()
                    })
                    .eq("profile_id", user.id);
                break;

            case "reset":
                // Reset to new
                await supabase
                    .from("candidates")
                    .update({
                        status: "NEW",
                        entry_fee_paid: false,
                        queue_position: null,
                        queue_joined_at: null,
                        rejection_count: 0,
                        refund_eligible: true,
                        updated_at: new Date().toISOString()
                    })
                    .eq("profile_id", user.id);
                break;

            case "switch_to_employer":
                // Create employer profile if not exists
                const { data: existingEmployer } = await supabase
                    .from("employers")
                    .select("id")
                    .eq("profile_id", user.id)
                    .single();

                if (!existingEmployer) {
                    await supabase.from("employers").insert({
                        profile_id: user.id,
                        company_name: "Test Company",
                        status: "pending"
                    });
                }

                // Update user_metadata in auth
                await supabase.auth.updateUser({
                    data: { user_type: "employer" }
                });

                // Update profile to employer
                await supabase
                    .from("profiles")
                    .update({ user_type: "employer" })
                    .eq("id", user.id);
                break;

            case "switch_to_candidate":
                // Create candidate profile if not exists
                const { data: existingCandidate } = await supabase
                    .from("candidates")
                    .select("id")
                    .eq("profile_id", user.id)
                    .single();

                if (!existingCandidate) {
                    await supabase.from("candidates").insert({
                        profile_id: user.id,
                        status: "NEW"
                    });
                }

                // Update user_metadata in auth
                await supabase.auth.updateUser({
                    data: { user_type: "candidate" }
                });

                // Update profile to candidate
                await supabase
                    .from("profiles")
                    .update({ user_type: "candidate" })
                    .eq("id", user.id);
                break;

            case "switch_to_admin":
                // Update auth metadata
                await supabase.auth.updateUser({
                    data: { user_type: "admin" }
                });
                // Update profiles table
                await supabase
                    .from("profiles")
                    .update({ user_type: "admin" })
                    .eq("id", user.id);
                break;

            default:
                return NextResponse.json({ error: "Unknown action" }, { status: 400 });
        }

        return NextResponse.json({ success: true, action });

    } catch (error) {
        console.error("God mode error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

async function getNextQueuePosition(supabase: any): Promise<number> {
    const { data } = await supabase
        .from("candidates")
        .select("queue_position")
        .not("queue_position", "is", null)
        .order("queue_position", { ascending: false })
        .limit(1);

    return (data?.[0]?.queue_position || 0) + 1;
}

// GET: Check god mode status
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError) {
            console.error("God mode auth error:", authError);
            return NextResponse.json({ godMode: false, error: authError.message });
        }

        if (!user) {
            return NextResponse.json({ godMode: false });
        }

        const isGod = isGodModeUser(user.email);
        console.log("God mode check:", { email: user.email, isGod });

        return NextResponse.json({
            godMode: isGod,
            email: user.email
        });

    } catch (error: any) {
        console.error("God mode GET error:", error);
        return NextResponse.json({ godMode: false, error: error.message });
    }
}
