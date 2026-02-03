"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function markRefunded(userId: string, notes: string) {
    const supabase = await createClient();

    // Check if the current user is an admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    if (profile?.role !== 'admin') {
        throw new Error("Forbidden: Admin access only");
    }

    // Update the latest payment record for this user
    const { error } = await supabase
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
