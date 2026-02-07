import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import AppShell from "@/components/AppShell";
import { isGodModeUser } from "@/lib/godmode";

export default async function AdminSettingsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const isOwner = isGodModeUser(user.email);

    return (
        <AppShell user={user} variant="admin">
            <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
                    <p className="text-slate-500">Platform configuration and management.</p>
                </div>

                {/* Platform Info */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h2 className="text-lg font-bold text-slate-900 mb-4">Platform Info</h2>
                    <div className="space-y-3">
                        <InfoRow label="Logged in as" value={user.email || "Unknown"} />
                        <InfoRow label="God Mode" value={isOwner ? "✅ Active" : "❌ Inactive"} />
                        <InfoRow label="Environment" value={process.env.NODE_ENV || "production"} />
                        <InfoRow label="Site URL" value={process.env.NEXT_PUBLIC_SITE_URL || "Not set"} />
                    </div>
                </div>

                {/* Integration Status */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h2 className="text-lg font-bold text-slate-900 mb-4">Integration Status</h2>
                    <div className="space-y-3">
                        <StatusRow label="Supabase" status={!!process.env.NEXT_PUBLIC_SUPABASE_URL} />
                        <StatusRow label="OpenAI (GPT-4o)" status={!!process.env.OPENAI_API_KEY} />
                        <StatusRow label="Stripe" status={!!process.env.STRIPE_SECRET_KEY} />
                        <StatusRow label="WhatsApp" status={!!process.env.WHATSAPP_TOKEN} />
                    </div>
                </div>

                {/* Pricing */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h2 className="text-lg font-bold text-slate-900 mb-4">Pricing Configuration</h2>
                    <div className="space-y-3">
                        <InfoRow label="Entry Fee" value="$9 (universal)" />
                        <InfoRow label="Placement Fee (Serbia)" value="$190" />
                        <InfoRow label="Refund Policy" value="90 days, auto-flagged" />
                        <InfoRow label="Employer Cost" value="FREE (always)" />
                    </div>
                </div>
            </div>
        </AppShell>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
            <span className="text-sm text-slate-500 font-medium">{label}</span>
            <span className="text-sm text-slate-900 font-semibold">{value}</span>
        </div>
    );
}

function StatusRow({ label, status }: { label: string; status: boolean }) {
    return (
        <div className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
            <span className="text-sm text-slate-500 font-medium">{label}</span>
            <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${status ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>
                {status ? "CONNECTED" : "NOT SET"}
            </span>
        </div>
    );
}
