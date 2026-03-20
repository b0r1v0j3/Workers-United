import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGodModeUser } from "@/lib/godmode";
import AppShell from "@/components/AppShell";
import AdaptiveSelect from "@/components/forms/AdaptiveSelect";
import { normalizeUserType } from "@/lib/domain";
import { loadAnnouncementTargets, sendAdminAnnouncement, type AnnouncementAudience } from "@/lib/admin-announcements";
import { buildPlatformUrl } from "@/lib/platform-contact";

async function ensureAdminUser() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        redirect("/login");
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .single();

    const profileType = normalizeUserType(profile?.user_type);
    const metadataType = normalizeUserType(user.user_metadata?.user_type);
    if (profileType !== "admin" && metadataType !== "admin" && !isGodModeUser(user.email)) {
        redirect("/profile");
    }

    return user;
}

export default async function AnnouncementsPage({
    searchParams,
}: {
    searchParams: Promise<{ success?: string; sent?: string; failed?: string; total?: string }>;
}) {
    const user = await ensureAdminUser();

    async function sendAnnouncement(formData: FormData) {
        "use server";

        const actionUser = await ensureAdminUser();

        const targetAudience = ((formData.get("target") as string) || "workers") as AnnouncementAudience;
        const subject = formData.get("subject") as string;
        const message = formData.get("message") as string;
        const actionText = formData.get("action_text") as string;
        const actionLink = formData.get("action_link") as string;

        if (!subject?.trim() || !message?.trim()) {
            redirect("/admin/announcements?success=false&sent=0&failed=0&total=0");
        }

        const admin = createAdminClient();
        const result = await sendAdminAnnouncement({
            admin,
            actorUserId: actionUser.id,
            audience: targetAudience,
            subject,
            message,
            actionText,
            actionLink,
        });

        redirect(`/admin/announcements?success=true&sent=${result.sent}&failed=${result.failed}&total=${result.total}`);
    }

    const admin = createAdminClient();
    const [targets, params] = await Promise.all([
        loadAnnouncementTargets(admin, "all"),
        searchParams,
    ]);
    const success = params.success;
    const sentCount = parseInt(params.sent || "0", 10);
    const failedCount = parseInt(params.failed || "0", 10);
    const totalCount = parseInt(params.total || "0", 10);
    const actionLinkPlaceholder = buildPlatformUrl(process.env.NEXT_PUBLIC_BASE_URL, "/profile/worker");

    return (
        <AppShell user={user} variant="admin">
            <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h1 className="text-2xl font-bold text-slate-900">Announcements</h1>
                    <p className="text-slate-500">Send bulk email notifications to real platform users.</p>
                </div>

                {success === "true" && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                        <div className="text-green-800 font-bold text-lg mb-1">Announcement queued</div>
                        <div className="text-green-700 text-sm">
                            <strong>{sentCount}</strong> emails sent
                            {failedCount > 0 && <span className="text-orange-600"> · {failedCount} failed</span>}
                            {" "}out of <strong>{totalCount}</strong> eligible recipients.
                        </div>
                    </div>
                )}

                {success === "false" && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                        <div className="text-red-800 font-bold text-lg mb-1">Announcement not sent</div>
                        <div className="text-red-700 text-sm">
                            Subject and message are required before sending a bulk announcement.
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                        <div className="text-3xl font-bold text-slate-900">{targets.length}</div>
                        <div className="text-sm text-slate-500 mt-1">Eligible recipients</div>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                        <div className="text-3xl font-bold text-slate-900">{targets.filter((target) => target.recipientRole === "worker").length}</div>
                        <div className="text-sm text-slate-500 mt-1">Workers</div>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                        <div className="text-3xl font-bold text-slate-900">{targets.filter((target) => target.recipientRole !== "worker").length}</div>
                        <div className="text-sm text-slate-500 mt-1">Employers + Agencies</div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 max-w-2xl mx-auto">
                    <form action={sendAnnouncement} className="space-y-6">

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Target Audience</label>
                            <AdaptiveSelect
                                name="target"
                                defaultValue="workers"
                                className="w-full border border-slate-300 rounded-lg px-4 py-3 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                desktopSearchThreshold={999}
                            >
                                <option value="workers">All Workers</option>
                                <option value="employers">All Employers</option>
                                <option value="agencies">All Agencies</option>
                                <option value="all">Everyone (Workers + Employers + Agencies)</option>
                            </AdaptiveSelect>
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
                                    placeholder={`e.g., ${actionLinkPlaceholder}`}
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

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                    <strong>⚠️ Note:</strong> Internal/test addresses and hidden agency draft-owner accounts are skipped automatically,
                    and worker sends now reuse the same direct-notification guard as the rest of the platform.
                </div>
            </div>
        </AppShell>
    );
}
