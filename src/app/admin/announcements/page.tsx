import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGodModeUser } from "@/lib/godmode";
import AppShell from "@/components/AppShell";
import { queueEmail } from "@/lib/email-templates";
import { revalidatePath } from "next/cache";

export default async function AnnouncementsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    const isOwner = isGodModeUser(user.email);
    if (profile?.role !== 'admin' && !isOwner) {
        redirect("/profile");
    }

    async function sendAnnouncement(formData: FormData) {
        "use server";

        const targetAudience = formData.get("target") as string;
        const subject = formData.get("subject") as string;
        const message = formData.get("message") as string;
        const actionText = formData.get("action_text") as string;
        const actionLink = formData.get("action_link") as string;

        if (!subject || !message) return;

        const adminClient = createAdminClient();

        // 1. Fetch Users
        const { data: authData } = await adminClient.auth.admin.listUsers();
        const allUsers = authData?.users || [];

        let recipients = [];

        if (targetAudience === 'workers') {
            recipients = allUsers.filter((u: any) => u.user_metadata?.user_type !== 'employer');
        } else if (targetAudience === 'employers') {
            recipients = allUsers.filter((u: any) => u.user_metadata?.user_type === 'employer');
        } else {
            recipients = allUsers;
        }

        // 2. Queue Emails
        let count = 0;
        for (const recipient of recipients) {
            if (recipient.email) {
                await queueEmail(
                    adminClient,
                    recipient.id,
                    "announcement",
                    recipient.email,
                    recipient.user_metadata?.full_name || "User",
                    {
                        title: subject,
                        message: message,
                        subject: subject,
                        actionText: actionText || "View Details",
                        actionLink: actionLink || "https://workersunited.eu/login"
                    }
                );
                count++;
            }
        }

        // Announcement emails queued
        redirect("/admin/announcements?success=true&count=" + count);
    }

    return (
        <AppShell user={user} variant="admin">
            <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h1 className="text-2xl font-bold text-slate-900">Announcements</h1>
                    <p className="text-slate-500">Send bulk email notifications to users.</p>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 max-w-2xl mx-auto">
                    <form action={sendAnnouncement} className="space-y-6">

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Target Audience</label>
                            <select name="target" className="w-full border border-slate-300 rounded-lg px-4 py-3 bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                                <option value="workers">All Workers</option>
                                <option value="employers">All Employers</option>
                                <option value="all">Everyone (Workers + Employers)</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Email Subject</label>
                            <input
                                type="text"
                                name="subject"
                                required
                                placeholder="e.g., Important Update: Profile Verification"
                                className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Message Body</label>
                            <textarea
                                name="message"
                                required
                                rows={6}
                                placeholder="Write your announcement here..."
                                className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            <p className="text-xs text-slate-500 mt-1">Accepts plain text. Newlines are preserved.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Button Text (Optional)</label>
                                <input
                                    type="text"
                                    name="action_text"
                                    placeholder="e.g., Update Profile"
                                    className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Button Link (Optional)</label>
                                <input
                                    type="text"
                                    name="action_link"
                                    placeholder="e.g., https://workersunited.eu/profile"
                                    className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100">
                            <button
                                type="submit"
                                className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                            >
                                Send Announcement 🚀
                            </button>
                        </div>

                    </form>
                </div>
            </div>
        </AppShell>
    );
}
