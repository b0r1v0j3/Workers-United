import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// One-time migration: update existing users from user_type "candidate" to "worker"
// DELETE THIS FILE AFTER RUNNING ONCE
export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user || user.user_metadata?.user_type !== "admin") {
            return NextResponse.json({ error: "Admin only" }, { status: 403 });
        }

        const adminClient = createAdminClient();
        const { data: authData } = await adminClient.auth.admin.listUsers();
        const allUsers = authData?.users || [];

        let updated = 0;
        for (const u of allUsers) {
            if (u.user_metadata?.user_type === "candidate") {
                // Update auth metadata
                await adminClient.auth.admin.updateUserById(u.id, {
                    user_metadata: { ...u.user_metadata, user_type: "worker" }
                });

                // Update profiles table
                await adminClient
                    .from("profiles")
                    .update({ user_type: "worker" })
                    .eq("id", u.id);

                updated++;
            }
        }

        return NextResponse.json({
            success: true,
            message: `Updated ${updated} users from 'candidate' to 'worker'`,
            total_users: allUsers.length
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
