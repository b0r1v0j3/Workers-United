"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGodModeUser } from "@/lib/godmode";
import AppShell from "@/components/AppShell";
import { normalizeUserType } from "@/lib/domain";
import { buildPlatformUrl } from "@/lib/platform-contact";
import { loadWorkerWhatsAppBlastTargets, sendWorkerWhatsAppBlast } from "@/lib/whatsapp-blast";

const WORKER_QUEUE_URL = buildPlatformUrl(process.env.NEXT_PUBLIC_BASE_URL, "/profile/worker/queue");

async function ensureAdminUser() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        redirect("/login");
    }

    const { data: profile } = await supabase.from("profiles").select("user_type").eq("id", user.id).single();
    const profileType = normalizeUserType(profile?.user_type);
    const metadataType = normalizeUserType(user.user_metadata?.user_type);
    if (profileType !== "admin" && metadataType !== "admin" && !isGodModeUser(user.email)) {
        redirect("/profile");
    }

    return user;
}

async function sendWhatsAppBlast(formData: FormData) {
    "use server";

    const user = await ensureAdminUser();
    const title = (formData.get("title") as string) || "Job Finder Is Unlocked";
    const customMessage = formData.get("message") as string;
    const dryRun = formData.get("dry_run") === "true";

    const admin = createAdminClient();
    const targets = await loadWorkerWhatsAppBlastTargets(admin);

    if (dryRun) {
        redirect(`/admin/whatsapp-blast?preview=true&count=${targets.length}`);
        return;
    }

    const result = await sendWorkerWhatsAppBlast({
        admin,
        actorUserId: user.id,
        title,
        customMessage,
    });

    redirect(`/admin/whatsapp-blast?sent=${result.sent}&failed=${result.failed}&total=${result.total}`);
}

export default async function WhatsAppBlastPage({
    searchParams,
}: {
    searchParams: Promise<{ sent?: string; failed?: string; total?: string; preview?: string; count?: string }>;
}) {
    const user = await ensureAdminUser();
    const admin = createAdminClient();
    const [targets, paidQuery, params] = await Promise.all([
        loadWorkerWhatsAppBlastTargets(admin),
        admin
            .from("worker_onboarding")
            .select("id", { count: "exact", head: true })
            .eq("entry_fee_paid", true),
        searchParams,
    ]);

    const validCount = targets.length;
    const paidCount = paidQuery.count || 0;
    const justSent = params.sent !== undefined;
    const isPreview = params.preview === "true";

    const defaultMessage = `Hi {name}! Your profile has been approved and Job Finder checkout is now unlocked in your dashboard. Open your dashboard to complete the $9 Job Finder checkout and we'll match you with employers in Europe. 90-day money-back guarantee. Dashboard: {link}`;

    return (
        <AppShell user={user} variant="admin">
            <div className="space-y-6 max-w-2xl mx-auto">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-xl">💬</div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">WhatsApp Blast</h1>
                            <p className="text-slate-500 text-sm">Send a Job Finder unlock reminder to approved workers who are truly payment-ready</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                        <div className="text-3xl font-bold text-orange-500">{validCount}</div>
                        <div className="text-sm text-slate-500 mt-1">Payment-ready unpaid workers</div>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                        <div className="text-3xl font-bold text-green-600">{paidCount}</div>
                        <div className="text-sm text-slate-500 mt-1">Paid (Job Finder)</div>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                        <div className="text-3xl font-bold text-slate-700">{validCount + paidCount}</div>
                        <div className="text-sm text-slate-500 mt-1">Ready + paid workers</div>
                    </div>
                </div>

                {justSent && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                        <div className="text-green-800 font-bold text-lg mb-1">✅ Blast sent!</div>
                        <div className="text-green-700 text-sm">
                            <strong>{params.sent}</strong> messages sent successfully
                            {params.failed && parseInt(params.failed, 10) > 0 && (
                                <span className="text-orange-600"> · {params.failed} failed</span>
                            )}
                            {" "}out of <strong>{params.total}</strong> payment-ready workers.
                        </div>
                    </div>
                )}

                {isPreview && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                        <div className="text-blue-800 font-bold text-lg mb-1">👁️ Dry run complete</div>
                        <div className="text-blue-700 text-sm">
                            Would send to <strong>{params.count}</strong> payment-ready workers. Submit the form without dry run to send for real.
                        </div>
                    </div>
                )}

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                    <form action={sendWhatsAppBlast} className="space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                Notification Title <span className="text-slate-400 font-normal">(template header)</span>
                            </label>
                            <input
                                type="text"
                                name="title"
                                defaultValue="Job Finder Is Unlocked"
                                className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-green-500 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                Message Body
                            </label>
                            <textarea
                                name="message"
                                rows={5}
                                defaultValue={defaultMessage}
                                className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-green-500 outline-none font-mono text-sm"
                            />
                            <p className="text-xs text-slate-400 mt-1">
                                Use <code className="bg-slate-100 px-1 rounded">{"{name}"}</code> for first name,{" "}
                                <code className="bg-slate-100 px-1 rounded">{"{link}"}</code> for the worker queue link.
                            </p>
                        </div>

                        <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-600">
                            <div className="font-semibold text-slate-700 mb-1">🔗 Worker Queue Link</div>
                            <a href={WORKER_QUEUE_URL} target="_blank" className="text-green-600 hover:underline break-all">
                                {WORKER_QUEUE_URL}
                            </a>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                type="submit"
                                name="dry_run"
                                value="true"
                                className="flex-1 bg-slate-100 text-slate-700 font-semibold py-3 rounded-xl hover:bg-slate-200 transition-colors"
                            >
                                👁️ Dry Run ({validCount} targets)
                            </button>
                            <button
                                type="submit"
                                className="flex-2 flex-grow-[2] bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 transition-colors shadow-lg shadow-green-200"
                            >
                                🚀 Send to {validCount} Payment-Ready Workers
                            </button>
                        </div>
                    </form>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                    <strong>⚠️ Note:</strong> This tool now reuses the same worker direct-notification guard as the rest of the platform,
                    plus the strict Job Finder payment gate, so agency drafts, internal/test contacts, workers without valid direct-contact ownership,
                    and workers who are not truly payment-ready are skipped automatically.
                </div>
            </div>
        </AppShell>
    );
}
