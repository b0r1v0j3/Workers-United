import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmailTemplate } from "@/lib/email-templates";

export async function POST(request: Request) {
    try {
        const supabase = createAdminClient();

        // Check authentication
        const authHeader = request.headers.get("Authorization");
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get all workers who have a profile but might be missing documents
        // To be safe, let's just send it to all workers who are NOT 'employer' or 'admin'
        // But better: workers who haven't completed verification.
        const { data: profiles, error: profileErr } = await supabase
            .from("profiles")
            .select("id, first_name, user_type")
            .eq("user_type", "worker")
            .eq("verification_status", "pending");

        if (profileErr) throw profileErr;

        if (!profiles || profiles.length === 0) {
            return NextResponse.json({ message: "No eligible profiles found", sentCount: 0 });
        }

        // Get their emails from max(updated_at)? Wait, we need auth.users to get emails.
        // It's easier to iterate through profiles, get email, then queue.
        let sentCount = 0;

        for (const profile of profiles) {
            // Fetch email from auth.users via RPC or just queue it 
            // Queueing requires email. Let's lookup email from a helper function if needed,
            // or we can use the admin auth.admin.getUserById
            const { data: userAuth, error: userErr } = await supabase.auth.admin.getUserById(profile.id);
            if (userErr || !userAuth.user?.email) continue;

            const email = userAuth.user.email;

            // Generate email content
            const template = getEmailTemplate("announcement_document_fix", {
                name: profile.first_name || "friend"
            });

            // Insert into email_queue
            const { error: queueErr } = await supabase
                .from("email_queue")
                .insert({
                    to_email: email,
                    subject: template.subject,
                    html_body: template.html,
                    scheduled_for: new Date().toISOString()
                });

            if (!queueErr) sentCount++;
        }

        return NextResponse.json({
            success: true,
            message: `Successfully queued ${sentCount} announcement emails.`
        });

    } catch (error: any) {
        console.error("Error triggering announcement:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
