import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGodModeUser } from "@/lib/godmode";
import AppShell from "@/components/AppShell";
import AdminSectionHero from "@/components/admin/AdminSectionHero";
import { pickCanonicalEmployerRecord, shouldHideEmployerFromBusinessViews, type EmployerRecordSnapshot } from "@/lib/employers";
import { getEmployerCompletion } from "@/lib/profile-completion";
import { Building2, Briefcase, Globe, MapPin, Phone, Users } from "lucide-react";
import { DeleteUserButton } from "@/components/DeleteUserButton";

interface EmployerAdminProfileRow {
    id: string;
    email: string;
    full_name: string | null;
    user_type: string | null;
}

interface EmployerAdminRow extends EmployerRecordSnapshot {
    id: string;
    profile_id: string | null;
    company_name?: string | null;
    company_registration_number?: string | null;
    contact_phone?: string | null;
    website?: string | null;
    company_size?: string | null;
    city?: string | null;
    country?: string | null;
    status?: string | null;
}

interface EmployerJobCountRow {
    employer_id: string | null;
}

interface EmployerListRow extends EmployerAdminRow {
    profiles: EmployerAdminProfileRow;
}

export default async function EmployersPage() {
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

    const adminClient = createAdminClient();

    // Fetch employers and profiles separately (no FK dependency)
    const { data: rawEmployers, error: empError } = await adminClient
        .from("employers")
        .select("*");
    if (empError) console.error("Employers fetch error:", empError);

    const { data: allProfiles } = await adminClient
        .from("profiles")
        .select("id, email, full_name, user_type");

    const profileRows = Array.isArray(allProfiles) ? (allProfiles as EmployerAdminProfileRow[]) : [];
    const employerRows = Array.isArray(rawEmployers) ? (rawEmployers as EmployerAdminRow[]) : [];
    const profileLookup = new Map(profileRows.map((profileRow) => [profileRow.id, profileRow] as const));
    const employerGroups = new Map<string, EmployerAdminRow[]>();
    for (const employer of employerRows) {
        const profileId = employer?.profile_id;
        if (!profileId) continue;
        const current = employerGroups.get(profileId) || [];
        current.push(employer);
        employerGroups.set(profileId, current);
    }

    const employers = Array.from(employerGroups.entries())
        .map(([profileId, rows]) => {
            const employer = pickCanonicalEmployerRecord(rows);
            if (!employer) {
                return null;
            }

            const employerProfile = profileLookup.get(profileId) || null;
            if (shouldHideEmployerFromBusinessViews({ employer, profile: employerProfile })) {
                return null;
            }

            return {
                ...employer,
                profiles: employerProfile || { email: "Unknown", full_name: "Unknown", id: profileId, user_type: null },
            };
        })
        .filter((employer): employer is EmployerListRow => !!employer);

    // Count jobs per employer
    const { data: jobCounts } = await adminClient
        .from("job_requests")
        .select("employer_id");
    const jobCountRows = Array.isArray(jobCounts) ? (jobCounts as EmployerJobCountRow[]) : [];

    const jobCountMap = new Map<string, number>();
    jobCountRows.forEach((jobCountRow) => {
        if (!jobCountRow.employer_id) return;
        jobCountMap.set(jobCountRow.employer_id, (jobCountMap.get(jobCountRow.employer_id) || 0) + 1);
    });
    const completedProfiles = employers.filter((employer) => getEmployerCompletion({ employer }).completion === 100).length;
    const pendingEmployers = employers.filter((employer) => (employer.status || "").toUpperCase() === "PENDING").length;
    const activeJobs = Array.from(jobCountMap.values()).reduce((sum, count) => sum + count, 0);
    const serbiaCompanies = employers.filter((employer) => employer.country?.trim().toLowerCase() === "serbia").length;

    return (
        <AppShell user={user} variant="admin">
            <div className="space-y-6">
                <AdminSectionHero
                    eyebrow="Admin employers"
                    title="Employer Operations"
                    description="Review company readiness, inspect the exact employer workspace, and jump straight into active job requests without mixing the admin account into the employer flow."
                    metrics={[
                        { label: "Employers", value: employers.length, meta: "Registered company accounts" },
                        { label: "Complete", value: completedProfiles, meta: "Profiles at 100%" },
                        { label: "Pending", value: pendingEmployers, meta: "Waiting for admin attention" },
                        { label: "Jobs", value: activeJobs, meta: "Job requests created" },
                        { label: "Serbia", value: serbiaCompanies, meta: "Primary market companies" },
                    ]}
                />

                <section className="grid gap-4 md:grid-cols-3">
                    <InfoPanel
                        title="Inspect workspace"
                        copy="Open the real employer workspace in read-only mode to see the company profile and job tabs exactly as the employer sees them."
                        icon={<Building2 size={18} />}
                        tone="dark"
                    />
                    <InfoPanel
                        title="Jobs tab"
                        copy="Jump straight into the employer jobs tab when you want to review hiring activity instead of company registration fields."
                        icon={<Briefcase size={18} />}
                        tone="blue"
                    />
                    <InfoPanel
                        title="Company readiness"
                        copy="Completion uses the same employer completion logic as the employer workspace, so admin and employer always see the same readiness signal."
                        icon={<Users size={18} />}
                        tone="amber"
                    />
                </section>

                <div className="rounded-[28px] border border-[#e6e6e1] bg-white p-6 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
                    <div className="mb-5">
                        <h2 className="text-lg font-semibold text-[#18181b]">Employer registry</h2>
                        <p className="mt-1 text-sm text-[#71717a]">Every employer account, with company readiness, job volume, and direct workspace inspection.</p>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                    {employers.map((employer) => (
                        <div key={employer.id} className="rounded-[24px] border border-[#e6e6e1] bg-[#fcfcfb] p-5 transition hover:border-[#d7d0c6] hover:bg-white">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div className="flex-1 min-w-0">
                                    <div className="mb-3 flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 font-bold text-sm shrink-0">
                                            {(employer.company_name || "?").charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="text-base font-bold text-slate-900">{employer.company_name || "No Name"}</h3>
                                            <div className="text-sm text-slate-500">{employer.profiles?.full_name} • {employer.profiles?.email}</div>
                                        </div>
                                    </div>

                                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                                        {employer.company_registration_number && (
                                            <span className="flex items-center gap-1"><Building2 size={14} /> Reg: {employer.company_registration_number}</span>
                                        )}
                                        {employer.country && (
                                            <span className="flex items-center gap-1"><MapPin size={14} /> {employer.city ? `${employer.city}, ` : ""}{employer.country}</span>
                                        )}
                                        {employer.contact_phone && (
                                            <span className="flex items-center gap-1"><Phone size={14} /> {employer.contact_phone}</span>
                                        )}
                                        {employer.company_size && (
                                            <span className="flex items-center gap-1"><Users size={14} /> {employer.company_size}</span>
                                        )}
                                        {employer.website && (
                                            <span className="flex items-center gap-1"><Globe size={14} /> {employer.website}</span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3 lg:min-w-[320px]">
                                    <div className="grid grid-cols-3 gap-3 text-center">
                                        <MetricChip label="Jobs" value={jobCountMap.get(employer.id) || 0} />
                                        <MetricChip label="Status" value={(employer.status || "pending").toUpperCase()} />
                                        <MetricChip label="Complete" value={`${getEmployerCompletion({ employer }).completion}%`} />
                                    </div>
                                    <div className="flex flex-wrap items-center justify-end gap-2 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                                        <Link
                                            href={employer.profile_id ? `/profile/employer?tab=jobs&inspect=${employer.profile_id}` : "/admin/employers"}
                                            className="inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 transition hover:bg-blue-100"
                                        >
                                            Open jobs tab
                                        </Link>
                                        <Link
                                            href={employer.profile_id ? `/profile/employer?inspect=${employer.profile_id}` : "/admin/employers"}
                                            className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
                                        >
                                            Inspect workspace
                                        </Link>
                                        {employer.profile_id ? (
                                            <DeleteUserButton userId={employer.profile_id} userName={employer.company_name || "this employer"} />
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}

                    {(!employers || employers.length === 0) && (
                        <div className="rounded-2xl border border-dashed border-[#ddd6c8] bg-[#faf8f3] p-10 text-center italic text-slate-400">
                            No employers registered yet.
                        </div>
                    )}
                    </div>
                </div>
            </div>
        </AppShell>
    );
}

function MetricChip({ label, value }: { label: string; value: string | number }) {
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
