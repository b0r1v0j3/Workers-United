// Quick script to confirm a user's email via Supabase Admin API
// Usage: npx tsx scripts/confirm-email.ts

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const email = "rt0244183@gmail.com";

async function main() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !serviceRoleKey) {
        console.error("Missing env vars");
        process.exit(1);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    // Find user by email
    const { data: { users }, error: listErr } = await admin.auth.admin.listUsers();
    if (listErr) { console.error("List error:", listErr); process.exit(1); }

    const user = users.find(u => u.email === email);
    if (!user) { console.error(`User ${email} not found`); process.exit(1); }

    console.log(`Found user: ${user.id} (${user.email})`);
    console.log(`Current email_confirmed_at: ${user.email_confirmed_at || "NOT CONFIRMED"}`);

    if (user.email_confirmed_at) {
        console.log("Email is already confirmed!");
        return;
    }

    // Confirm the email
    const { data, error } = await admin.auth.admin.updateUserById(user.id, {
        email_confirm: true,
    });

    if (error) {
        console.error("Error confirming:", error);
        process.exit(1);
    }

    console.log(`✅ Email confirmed for ${data.user.email}`);
}

main();
