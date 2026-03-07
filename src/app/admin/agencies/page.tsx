import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGodModeUser } from "@/lib/godmode";
import { Building2, Mail, MapPin, Users } from "lucide-react";

type AgencySummary = {
    id: string;
    profile_id: string;
    display_name: string | null;
    legal_name: string | null;
    contact_email: string | null;
    country: string | null;
    city: string | null;
    status: string | null;
    created_at: string;
    profile?: {
        email: string | null;
        full_name: string | null;
    };
    workersTotal: number;
    claimedWorkers: number;
    draftWorkers: number;
};

export default async function AgenciesPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: profile } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .single();

    if (profile?.user_type !== "admin" && !isGodModeUser(user.email)) {
        redirect("/profile");
    }

    const admin = createAdminClient();
    const [{ data: rawAgencies }, { data: profiles }, { data: workers }] = await Promise.all([
        admin.from("agencies").select("*").order("created_at", { ascending: false }),
        admin.from("profiles").select("id, email, full_name"),
        admin.from("candidates").select("agency_id, profile_id"),
    ]);

    const profileLookup = new Map((profiles || []).map((entry: any) => [entry.id, entry]));
    const workerCounts = new Map<string, { total: number; claimed: number; draft: number }>();

    for (const worker of workers || []) {
        if (!worker.agency_id) continue;
        const current = workerCounts.get(worker.agency_id) || { total: 0, claimed: 0, draft: 0 };
        current.total += 1;
        if (worker.profile_id) {
            current.claimed += 1;
        } else {
            current.draft += 1;
        }
        workerCounts.set(worker.agency_id, current);
    }

    const agencies: AgencySummary[] = (rawAgencies || []).map((agency: any) => {
        const counts = workerCounts.get(agency.id) || { total: 0, claimed: 0, draft: 0 };
        return {
            ...agency,
            profile: profileLookup.get(agency.profile_id),
            workersTotal: counts.total,
            claimedWorkers: counts.claimed,
            draftWorkers: counts.draft,
        };
    });

    return (
        <AppShell user={user} variant="admin">
            <div className="space-y-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h1 className="text-2xl font-bold text-slate-900">Agencies</h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Track agency accounts, their worker volume, and open the exact agency workspace in read-only mode.
                    </p>
                </div>

                {agencies.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm italic text-slate-400">
                        No agencies found yet.
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {agencies.map((agency) => (
                            <div key={agency.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="min-w-0 flex-1">
                                        <div className="mb-3 flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
                                                <Building2 size={18} />
                                            </div>
                                            <div className="min-w-0">
                                                <h2 className="truncate text-base font-bold text-slate-900">
                                                    {agency.display_name || agency.legal_name || "Unnamed agency"}
                                                </h2>
                                                <p className="truncate text-sm text-slate-500">
                                                    {agency.profile?.full_name || "Unknown owner"} • {agency.profile?.email || agency.contact_email || "No email"}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-600">
                                            {(agency.city || agency.country) && (
                                                <span className="flex items-center gap-1">
                                                    <MapPin size={14} />
                                                    {[agency.city, agency.country].filter(Boolean).join(", ")}
                                                </span>
                                            )}
                                            {(agency.contact_email || agency.profile?.email) && (
                                                <span className="flex items-center gap-1">
                                                    <Mail size={14} />
                                                    {agency.contact_email || agency.profile?.email}
                                                </span>
                                            )}
                                            <span className="flex items-center gap-1">
                                                <Users size={14} />
                                                {agency.workersTotal} workers
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-3 lg:min-w-[280px]">
                                        <div className="grid grid-cols-3 gap-3 text-center">
                                            <MetricChip label="Total" value={agency.workersTotal} />
                                            <MetricChip label="Claimed" value={agency.claimedWorkers} />
                                            <MetricChip label="Drafts" value={agency.draftWorkers} />
                                        </div>
                                        <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                                            <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                                                {agency.status || "active"}
                                            </span>
                                            <a
                                                href={`/profile/agency?inspect=${agency.profile_id}`}
                                                className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
                                            >
                                                Open Workspace
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AppShell>
    );
}

function MetricChip({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
            <div className="mt-1 text-xl font-bold text-slate-900">{value}</div>
        </div>
    );
}
