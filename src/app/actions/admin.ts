"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function markRefunded(userId: string, notes: string) {
    const supabase = await createClient();

    // Check if the current user is an admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { data: profile } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .single();

    if (profile?.user_type !== 'admin') {
        throw new Error("Forbidden: Admin access only");
    }

    // Use admin client to bypass RLS — we're updating another user's payment
    const adminClient = createAdminClient();

    // Update the latest payment record for this user
    const { error } = await adminClient
        .from("payments")
        .update({
            refund_status: 'completed',
            refund_notes: notes,
            updated_at: new Date().toISOString()
        })
        .eq("user_id", userId) // userId from the dashboard
        .eq("status", "completed");

    if (error) {
        console.error("Error marking as refunded:", error);
        throw new Error("Failed to update payment status");
    }

    revalidatePath("/admin");
    return { success: true };
}
