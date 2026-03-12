import { redirect } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGodModeUser } from "@/lib/godmode";
import AdminSectionHero from "@/components/admin/AdminSectionHero";
import { Building2, BadgeCheck, Mail, MapPin, Users } from "lucide-react";
import { DeleteUserButton } from "@/components/DeleteUserButton";

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
        admin.from("worker_onboarding").select("agency_id, profile_id"),
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
    const totalAgencyWorkers = agencies.reduce((sum, agency) => sum + agency.workersTotal, 0);
    const totalClaimedWorkers = agencies.reduce((sum, agency) => sum + agency.claimedWorkers, 0);
    const totalDraftWorkers = agencies.reduce((sum, agency) => sum + agency.draftWorkers, 0);
    const activeAgencies = agencies.filter((agency) => (agency.status || "active") === "active").length;

    return (
        <AppShell user={user} variant="admin">
            <div className="space-y-6">
                <AdminSectionHero
                    eyebrow="Admin agencies"
                    title="Agency Operations"
                    description="Track every agency account, understand how many workers they brought in, and inspect the exact agency workspace without letting admin accidentally behave like an agency."
                    metrics={[
                        { label: "Agencies", value: agencies.length, meta: `${activeAgencies} active` },
                        { label: "Workers", value: totalAgencyWorkers, meta: "Submitted through agencies" },
                        { label: "Claimed", value: totalClaimedWorkers, meta: "Workers who took control" },
                        { label: "Drafts", value: totalDraftWorkers, meta: "Still agency-managed only" },
                    ]}
                />

                <section className="grid gap-4 md:grid-cols-3">
                    <InfoPanel
                        title="Inspect workspace"
                        copy="Open the exact agency dashboard and worker list in read-only mode, without touching the admin role."
                        icon={<Building2 size={18} />}
                        tone="dark"
                    />
                    <InfoPanel
                        title="Claimed vs draft"
                        copy="Claimed means the worker took over the profile. Draft means the agency still owns the intake and the worker has not claimed it yet."
                        icon={<BadgeCheck size={18} />}
                        tone="blue"
                    />
                    <InfoPanel
                        title="Operational view"
                        copy="This page is for agency health and volume. Use the agency workspace itself when you need worker-by-worker operational signals."
                        icon={<Users size={18} />}
                        tone="amber"
                    />
                </section>

                <div className="rounded-[28px] border border-[#e6e6e1] bg-white p-6 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
                    <div className="mb-5">
                        <h2 className="text-lg font-semibold text-[#18181b]">Agency registry</h2>
                        <p className="mt-1 text-sm text-[#71717a]">Every agency account with ownership volume and direct workspace inspection.</p>
                    </div>

                    {agencies.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-[#ddd6c8] bg-[#faf8f3] p-10 text-center text-sm italic text-slate-400">
                            No agencies found yet.
                        </div>
                    ) : (
                        <div className="grid gap-4">
                        {agencies.map((agency) => (
                            <div key={agency.id} className="rounded-[24px] border border-[#e6e6e1] bg-[#fcfcfb] p-5 transition hover:border-[#d7d0c6] hover:bg-white">
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
                                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                                            <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                                                {agency.status || "active"}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <Link
                                                    href={`/profile/agency?inspect=${agency.profile_id}`}
                                                    className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
                                                >
                                                    Inspect workspace
                                                </Link>
                                                <DeleteUserButton userId={agency.profile_id} userName={agency.display_name || agency.legal_name || "this agency"} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        </div>
                    )}
                </div>
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

function InfoPanel({
    title,
    copy,
    icon,
    tone,
}: {
    title: string;
    copy: string;
    icon: React.ReactNode;
    tone: "dark" | "blue" | "amber";
}) {
    const toneClass = tone === "blue"
        ? "bg-blue-600 text-white"
        : tone === "amber"
            ? "bg-amber-500 text-white"
            : "bg-[#111111] text-white";

    return (
        <div className="rounded-[24px] border border-[#e6e6e1] bg-white p-5 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
            <div className="mb-3 flex items-center gap-3">
                <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${toneClass}`}>
                    {icon}
                </div>
                <h2 className="text-base font-semibold text-[#18181b]">{title}</h2>
            </div>
            <p className="text-sm leading-relaxed text-[#57534e]">{copy}</p>
        </div>
    );
}
