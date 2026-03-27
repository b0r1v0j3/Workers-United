import { redirect } from "next/navigation";
import Link from "next/link";
import type { User as SupabaseAuthUser } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, getAllAuthUsers } from "@/lib/supabase/admin";
import { isGodModeUser } from "@/lib/godmode";
import AppShell from "@/components/AppShell";
import { BadgeCheck, Hourglass, ListOrdered, Users } from "lucide-react";
import { getWorkerCompletion } from "@/lib/profile-completion";
import AdminSectionHero from "@/components/admin/AdminSectionHero";
import WorkersTableClient, { WorkerTableRow } from "./WorkersTableClient";
import { pickCanonicalWorkerRecord, type WorkerRecordSnapshot } from "@/lib/workers";
import { getAgencyDraftDocumentOwnerId, resolveAgencyWorkerDocumentOwnerId } from "@/lib/agency-draft-documents";
import { getAgencyWorkerEmail, getAgencyWorkerName } from "@/lib/agencies";
import { getWorkerDocumentProgress } from "@/lib/worker-documents";
import { isPostEntryFeeWorkerStatus } from "@/lib/worker-status";
import type { Json } from "@/lib/database.types";
import {
    getProfileRetentionState,
    PROFILE_INACTIVITY_UI_ALERT_DAYS,
    PROFILE_RETENTION_ACTIVITY_CATEGORIES,
    PROFILE_RETENTION_CASE_EMAIL_TYPES,
} from "@/lib/profile-retention";

interface AdminWorkerRegistryRow extends WorkerRecordSnapshot {
    id: string;
    profile_id: string | null;
    agency_id?: string | null;
    application_data?: Json | null;
    submitted_full_name?: string | null;
    submitted_email?: string | null;
    phone?: string | null;
    nationality?: string | null;
    preferred_job?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    admin_approved?: boolean | null;
}

interface AdminWorkerProfileRow {
    id: string;
    full_name?: string | null;
    email?: string | null;
    avatar_url?: string | null;
    created_at?: string | null;
    user_type?: string | null;
}

interface AdminWorkerDocumentRow {
    user_id: string | null;
    document_type: string;
    status?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
}

interface AdminEmployerProfileLinkRow {
    profile_id: string | null;
}

interface AdminAgencyRow {
    id: string;
    profile_id?: string | null;
    display_name?: string | null;
    legal_name?: string | null;
}

interface AdminSignatureRow {
    user_id: string | null;
    created_at: string | null;
}

interface AdminRetentionEmailRow {
    user_id: string | null;
    email_type?: string | null;
    created_at: string | null;
    sent_at: string | null;
}

interface AdminUserActivityRow {
    user_id: string | null;
    category?: string | null;
    created_at: string | null;
}

export default async function WorkersPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
    const params = await searchParams;
    const filter = params?.filter || 'all';
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const isOwner = isGodModeUser(user.email);

    const { data: profile } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .single();

    if (profile?.user_type !== 'admin' && !isOwner) {
        redirect("/profile");
    }

    // Use admin client (service role) — same pattern as admin dashboard
    const adminClient = createAdminClient();

    const [
        allAuthUsers,
        { data: workerRows },
        { data: profiles },
        { data: allDocs },
        { data: employerRows },
        { data: agencies },
        { data: signatures },
        { data: retentionEmails },
        { data: userActivity },
    ] = await Promise.all([
        getAllAuthUsers(adminClient),
        adminClient.from("worker_onboarding").select("*"),
        adminClient.from("profiles").select("*"),
        adminClient.from("worker_documents").select("*"),
        adminClient.from("employers").select("profile_id"),
        adminClient.from("agencies").select("id, profile_id, display_name, legal_name"),
        adminClient.from("signatures").select("user_id, created_at"),
        adminClient.from("email_queue")
            .select("user_id, email_type, created_at, sent_at")
            .in("email_type", [...PROFILE_RETENTION_CASE_EMAIL_TYPES]),
        adminClient.from("user_activity")
            .select("user_id, category, created_at")
            .in("category", [...PROFILE_RETENTION_ACTIVITY_CATEGORIES]),
    ]);
    const typedWorkerRows = Array.isArray(workerRows) ? (workerRows as AdminWorkerRegistryRow[]) : [];
    const profileRows = Array.isArray(profiles) ? (profiles as AdminWorkerProfileRow[]) : [];
    const documentRows = Array.isArray(allDocs) ? (allDocs as AdminWorkerDocumentRow[]) : [];
    const typedEmployerRows = Array.isArray(employerRows) ? (employerRows as AdminEmployerProfileLinkRow[]) : [];
    const typedAgencies = Array.isArray(agencies) ? (agencies as AdminAgencyRow[]) : [];
    const typedSignatures = Array.isArray(signatures) ? (signatures as AdminSignatureRow[]) : [];
    const typedRetentionEmails = Array.isArray(retentionEmails) ? (retentionEmails as AdminRetentionEmailRow[]) : [];
    const typedUserActivity = Array.isArray(userActivity) ? (userActivity as AdminUserActivityRow[]) : [];

    const workerGroups = new Map<string, AdminWorkerRegistryRow[]>();
    const hiddenDraftOwnerIds = new Set<string>();
    for (const workerRow of typedWorkerRows) {
        const draftOwnerId = getAgencyDraftDocumentOwnerId(workerRow?.application_data);
        if (draftOwnerId) {
            hiddenDraftOwnerIds.add(draftOwnerId);
        }

        if (!workerRow?.profile_id) continue;
        const current = workerGroups.get(workerRow.profile_id) || [];
        current.push(workerRow);
        workerGroups.set(workerRow.profile_id, current);
    }

    const workerMap = new Map(
        Array.from(workerGroups.entries())
            .map(([profileId, rows]) => [profileId, pickCanonicalWorkerRecord(rows)])
            .filter((entry): entry is [string, AdminWorkerRegistryRow] => !!entry[1])
    );
    const profileMap = new Map(profileRows.map((profileRow) => [profileRow.id, profileRow] as const));
    const agencyMap = new Map(typedAgencies.map((agency) => [agency.id, agency] as const));
    const documentsByOwnerId = new Map<string, AdminWorkerDocumentRow[]>();
    for (const doc of documentRows) {
        if (!doc?.user_id) continue;
        const current = documentsByOwnerId.get(doc.user_id) || [];
        current.push(doc);
        documentsByOwnerId.set(doc.user_id, current);
    }
    const latestSignatureByUser = new Map<string, string>();
    for (const signature of typedSignatures) {
        if (!signature?.user_id || !signature.created_at) continue;
        const previous = latestSignatureByUser.get(signature.user_id);
        if (!previous || new Date(signature.created_at).getTime() > new Date(previous).getTime()) {
            latestSignatureByUser.set(signature.user_id, signature.created_at);
        }
    }
    const latestCaseEmailByUser = new Map<string, string>();
    for (const email of typedRetentionEmails) {
        if (!email?.user_id) continue;
        const candidate = email.sent_at || email.created_at;
        if (!candidate) continue;
        const previous = latestCaseEmailByUser.get(email.user_id);
        if (!previous || new Date(candidate).getTime() > new Date(previous).getTime()) {
            latestCaseEmailByUser.set(email.user_id, candidate);
        }
    }
    const latestActivityByUser = new Map<string, string>();
    for (const activity of typedUserActivity) {
        if (!activity?.user_id || !activity.created_at) continue;
        const previous = latestActivityByUser.get(activity.user_id);
        if (!previous || new Date(activity.created_at).getTime() > new Date(previous).getTime()) {
            latestActivityByUser.set(activity.user_id, activity.created_at);
        }
    }

    // Exclude non-worker auth users and hidden agency draft document-owner accounts.
    const excludedProfileIds = new Set<string>();
    profileRows
        .filter((profileRow) => ["employer", "admin", "agency"].includes(String(profileRow.user_type || "")))
        .forEach((profileRow) => excludedProfileIds.add(profileRow.id));
    typedEmployerRows.forEach((employerRow) => {
        if (employerRow.profile_id) {
            excludedProfileIds.add(employerRow.profile_id);
        }
    });
    allAuthUsers
        .filter((authUser: SupabaseAuthUser) => ["employer", "admin", "agency"].includes(String(authUser.user_metadata?.user_type || "")))
        .forEach((authUser) => excludedProfileIds.add(authUser.id));
    allAuthUsers
        .filter((authUser: SupabaseAuthUser) => Boolean(authUser.user_metadata?.hidden_draft_owner))
        .forEach((authUser) => hiddenDraftOwnerIds.add(authUser.id));

    const claimedRegistryRows: WorkerTableRow[] = allAuthUsers
        .filter((authUser) => !excludedProfileIds.has(authUser.id) && !hiddenDraftOwnerIds.has(authUser.id))
        .map((authUser) => {
            const workerRecord = workerMap.get(authUser.id);
            const profileRecord = profileMap.get(authUser.id);
            const workerDocs = documentsByOwnerId.get(authUser.id) || [];
            const documentProgress = getWorkerDocumentProgress(workerDocs);
            const agencyRecord = workerRecord?.agency_id ? agencyMap.get(workerRecord.agency_id) : null;
            const completion = getWorkerCompletion({
                profile: profileRecord || null,
                worker: workerRecord || null,
                documents: workerDocs,
            }, {
                phoneOptional: !!workerRecord?.agency_id,
                fullNameFallback: authUser.user_metadata?.full_name || null,
            }).completion;
            const displayEmail = authUser.email || profileRecord?.email || "No email yet";
            const displayName = profileRecord?.full_name || authUser.user_metadata?.full_name || displayEmail || "No Name";
            const paymentState = workerRecord?.entry_fee_paid
                ? "Paid"
                : isPostEntryFeeWorkerStatus(workerRecord?.status)
                    ? "In Queue"
                    : "Unpaid";
            const latestDocumentAt = workerDocs.reduce<string | null>((latest, doc) => {
                const candidate = doc?.updated_at || doc?.created_at || null;
                if (!candidate) return latest;
                if (!latest || new Date(candidate).getTime() > new Date(latest).getTime()) {
                    return candidate;
                }
                return latest;
            }, null);
            const retentionState = getProfileRetentionState({
                authCreatedAt: authUser.created_at,
                profileCreatedAt: profileRecord?.created_at || null,
                roleRecordCreatedAt: workerRecord?.created_at || null,
                roleRecordUpdatedAt: workerRecord?.updated_at || null,
                latestDocumentAt,
                latestSignatureAt: latestSignatureByUser.get(authUser.id) || null,
                latestCaseEmailAt: latestCaseEmailByUser.get(authUser.id) || null,
                latestUserActivityAt: latestActivityByUser.get(authUser.id) || null,
            });

            return {
                id: workerRecord?.id || authUser.id,
                profile_id: authUser.id,
                name: displayName,
                email: displayEmail,
                avatar_url: profileRecord?.avatar_url || authUser.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${displayName.replace(/ /g, "+")}&background=random`,
                created_at: workerRecord?.created_at || authUser.created_at,
                status: workerRecord?.status || "NEW",
                phone: workerRecord?.phone || "",
                nationality: workerRecord?.nationality || "",
                job: workerRecord?.preferred_job || "",
                completion,
                docsCount: documentProgress.uploadedCount,
                verifiedDocs: documentProgress.verifiedCount,
                adminApproved: !!workerRecord?.admin_approved,
                isCurrentUser: authUser.id === user.id,
                entryFeePaid: !!workerRecord?.entry_fee_paid,
                daysUntilDeletion: !workerRecord?.agency_id
                    && completion < 100
                    && !workerRecord?.entry_fee_paid
                    && !isPostEntryFeeWorkerStatus(workerRecord?.status)
                    && retentionState.isNearDeletion
                    && retentionState.daysUntilDeletion <= PROFILE_INACTIVITY_UI_ALERT_DAYS
                    ? retentionState.daysUntilDeletion
                    : null,
                authProvider: authUser.app_metadata?.provider || "email",
                paymentState,
                hasVerifyingDocs: workerDocs.some((doc) => doc.status === "verifying"),
                sourceLabel: agencyRecord
                    ? `Agency worker · ${agencyRecord.display_name || agencyRecord.legal_name || "Unknown agency"}`
                    : null,
                workspaceHref: `/profile/worker?inspect=${authUser.id}`,
                workspaceLabel: "Inspect workspace",
                caseHref: `/admin/workers/${workerRecord?.id || authUser.id}`,
                caseLabel: "Open case",
                deleteUserId: authUser.id,
            } satisfies WorkerTableRow;
        });

    const draftRegistryRows: WorkerTableRow[] = typedWorkerRows
        .filter((workerRow) => workerRow.agency_id && !workerRow.profile_id)
        .map((workerRow) => {
            const agencyRecord = workerRow.agency_id ? agencyMap.get(workerRow.agency_id) || null : null;
            const documentOwnerId = resolveAgencyWorkerDocumentOwnerId(workerRow);
            const workerDocs = documentOwnerId ? documentsByOwnerId.get(documentOwnerId) || [] : [];
            const documentProgress = getWorkerDocumentProgress(workerDocs);
            const displayName = getAgencyWorkerName({ submitted_full_name: workerRow.submitted_full_name, profiles: null });
            const displayEmail = getAgencyWorkerEmail({ submitted_email: workerRow.submitted_email, profiles: null }) || "No email yet";
            const completion = getWorkerCompletion({
                profile: { full_name: displayName },
                worker: workerRow,
                documents: workerDocs,
            }, {
                phoneOptional: true,
                fullNameFallback: displayName,
            }).completion;
            const paymentState = workerRow.entry_fee_paid
                ? "Paid"
                : isPostEntryFeeWorkerStatus(workerRow.status)
                    ? "In Queue"
                    : "Unpaid";

            return {
                id: workerRow.id,
                profile_id: null,
                name: displayName,
                email: displayEmail,
                avatar_url: `https://ui-avatars.com/api/?name=${displayName.replace(/ /g, "+")}&background=random`,
                created_at: workerRow.created_at || workerRow.updated_at || new Date().toISOString(),
                status: workerRow.status || "NEW",
                phone: workerRow.phone || "",
                nationality: workerRow.nationality || "",
                job: workerRow.preferred_job || "",
                completion,
                docsCount: documentProgress.uploadedCount,
                verifiedDocs: documentProgress.verifiedCount,
                adminApproved: !!workerRow.admin_approved,
                isCurrentUser: false,
                entryFeePaid: !!workerRow.entry_fee_paid,
                daysUntilDeletion: null,
                authProvider: "email",
                paymentState,
                hasVerifyingDocs: workerDocs.some((doc) => doc.status === "verifying"),
                sourceLabel: `Agency draft · ${agencyRecord?.display_name || agencyRecord?.legal_name || "Unknown agency"}`,
                workspaceHref: agencyRecord?.profile_id
                    ? `/profile/agency/workers/${workerRow.id}?inspect=${agencyRecord.profile_id}`
                    : `/admin/agencies`,
                workspaceLabel: "Inspect draft",
                caseHref: `/admin/workers/${workerRow.id}`,
                caseLabel: "Open case",
                deleteUserId: null,
            } satisfies WorkerTableRow;
        });

    const activeWorkers = [...claimedRegistryRows, ...draftRegistryRows].sort((left, right) =>
        new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
    );

    // Apply filter
    let filteredUsers = activeWorkers;
    const statusFilters = ['NEW', 'PROFILE_COMPLETE', 'PENDING_APPROVAL', 'VERIFIED', 'APPROVED', 'IN_QUEUE', 'OFFER_PENDING', 'OFFER_ACCEPTED', 'VISA_PROCESS_STARTED', 'VISA_APPROVED', 'PLACED', 'REJECTED', 'REFUND_FLAGGED'];

    if (filter === 'pending') {
        filteredUsers = activeWorkers.filter((workerRow) => !!workerRow.hasVerifyingDocs);
    } else if (filter === 'verified') {
        filteredUsers = activeWorkers.filter((workerRow) => workerRow.verifiedDocs >= 3);
    } else if (filter === 'needs_approval') {
        filteredUsers = activeWorkers.filter((workerRow) => workerRow.completion === 100 && !workerRow.adminApproved);
    } else if (statusFilters.includes(filter)) {
        filteredUsers = activeWorkers.filter((workerRow) => workerRow.status === filter);
    }

    const filterLabels: Record<string, string> = {
        all: 'All', pending: 'Pending Docs', verified: 'Verified Docs', needs_approval: 'Needs Approval',
        NEW: 'New', PROFILE_COMPLETE: 'Profile Complete', PENDING_APPROVAL: 'Pending Approval',
        VERIFIED: 'Verified', APPROVED: 'Approved', IN_QUEUE: 'In Queue', OFFER_PENDING: 'Offer Pending',
        OFFER_ACCEPTED: 'Offer Accepted', VISA_PROCESS_STARTED: 'Visa Started',
        VISA_APPROVED: 'Visa Approved', PLACED: 'Placed', REJECTED: 'Rejected', REFUND_FLAGGED: 'Refund',
    };
    const filterLabel = filterLabels[filter] || 'All';
    const readyWorkersCount = activeWorkers.filter((workerRow) => workerRow.completion === 100).length;
    const needsApprovalCount = activeWorkers.filter((workerRow) => workerRow.completion === 100 && !workerRow.adminApproved).length;
    const queueCount = activeWorkers.filter((workerRow) => workerRow.status === "IN_QUEUE").length;
    const paidWorkersCount = activeWorkers.filter((workerRow) => workerRow.entryFeePaid).length;

    return (
        <AppShell user={user} variant="admin">
            <div className="space-y-6">
                <AdminSectionHero
                    eyebrow="Admin workers"
                    title="Worker Operations"
                    description="Use this list for two different jobs: inspect the real worker workspace, or open the admin case view for approvals, payments, documents, and queue handling."
                    metrics={[
                        { label: "Workers", value: activeWorkers.length, meta: `${filterLabel} view: ${filteredUsers.length}` },
                        { label: "Ready", value: readyWorkersCount, meta: "100% profile + required docs" },
                        { label: "Approval", value: needsApprovalCount, meta: "Waiting for admin" },
                        { label: "In Queue", value: queueCount, meta: "Active Job Finder workers" },
                        { label: "Paid", value: paidWorkersCount, meta: "Entry fee confirmed" },
                    ]}
                />

                <section className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-[24px] border border-[#e6e6e1] bg-white p-5 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
                        <div className="mb-3 flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#111111] text-white">
                                <Users size={18} />
                            </div>
                            <div>
                                <h2 className="text-base font-semibold text-[#18181b]">Inspect workspace</h2>
                                <p className="text-sm text-[#71717a]">Read-only worker workspace with the exact user data.</p>
                            </div>
                        </div>
                        <p className="text-sm leading-relaxed text-[#57534e]">
                            Use the <span className="font-semibold text-[#18181b]">Inspect workspace</span> action when you want to see what the worker sees.
                        </p>
                    </div>
                    <div className="rounded-[24px] border border-[#e6e6e1] bg-white p-5 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
                        <div className="mb-3 flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white">
                                <BadgeCheck size={18} />
                            </div>
                            <div>
                                <h2 className="text-base font-semibold text-[#18181b]">Case view</h2>
                                <p className="text-sm text-[#71717a]">Admin-only detail view for approvals, documents, and payments.</p>
                            </div>
                        </div>
                        <p className="text-sm leading-relaxed text-[#57534e]">
                            Use <span className="font-semibold text-[#18181b]">Open case</span> when you need admin actions, review tools, or payment history.
                        </p>
                    </div>
                    <div className="rounded-[24px] border border-[#e6e6e1] bg-white p-5 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
                        <div className="mb-3 flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500 text-white">
                                <ListOrdered size={18} />
                            </div>
                            <div>
                                <h2 className="text-base font-semibold text-[#18181b]">Current focus</h2>
                                <p className="text-sm text-[#71717a]">The filter pills below drive the list and table count.</p>
                            </div>
                        </div>
                        <p className="text-sm leading-relaxed text-[#57534e]">
                            {filter === "all"
                                ? "You are looking at the full worker registry."
                                : `You are focused on ${filterLabel.toLowerCase()} workers right now.`}
                        </p>
                    </div>
                </section>

                <div className="rounded-[28px] border border-[#e6e6e1] bg-white p-5 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
                    <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-[#18181b]">Worker filters</h2>
                            <p className="text-sm text-[#71717a]">
                                {filter !== 'all' ? `${filterLabel} (${filteredUsers.length})` : `${activeWorkers.length} registered workers`}
                            </p>
                        </div>
                        <div className="rounded-full border border-[#ebe7df] bg-[#faf8f3] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b675d]">
                            Filters update the table below
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                        <FilterTab href="/admin/workers" label="All" active={filter === 'all'} color="slate" />
                        <FilterTab href="/admin/workers?filter=NEW" label="New" active={filter === 'NEW'} color="slate" />
                        <FilterTab href="/admin/workers?filter=VERIFIED" label="Verified" active={filter === 'VERIFIED'} color="emerald" />
                        <FilterTab href="/admin/workers?filter=APPROVED" label="Approved" active={filter === 'APPROVED'} color="indigo" />
                        <FilterTab href="/admin/workers?filter=IN_QUEUE" label="In Queue" active={filter === 'IN_QUEUE'} color="amber" />
                        <FilterTab href="/admin/workers?filter=OFFER_PENDING" label="Offer" active={filter === 'OFFER_PENDING' || filter === 'OFFER_ACCEPTED'} color="orange" />
                        <FilterTab href="/admin/workers?filter=VISA_PROCESS_STARTED" label="Visa" active={filter === 'VISA_PROCESS_STARTED' || filter === 'VISA_APPROVED'} color="green" />
                        <FilterTab href="/admin/workers?filter=PLACED" label="Placed" active={filter === 'PLACED'} color="green" />
                        <FilterTab href="/admin/workers?filter=REJECTED" label="Rejected" active={filter === 'REJECTED'} color="red" />
                        <FilterTab href="/admin/workers?filter=REFUND_FLAGGED" label="Refund" active={filter === 'REFUND_FLAGGED'} color="rose" />
                        <FilterTab href="/admin/workers?filter=needs_approval" label="Needs Approval" icon={<Hourglass size={12} />} active={filter === 'needs_approval'} color="purple" />
                    </div>
                </div>

                <WorkersTableClient
                    data={filteredUsers}
                    currentFilter={filter}
                />
            </div>
        </AppShell>
    );
}

// ─── Components ──────────────────────────────────────────────

function FilterTab({ href, label, active, color, icon }: {
    href: string; label: string; active: boolean; color: string; icon?: React.ReactNode;
}) {
    const colorMap: Record<string, { activeBg: string; activeText: string }> = {
        slate: { activeBg: "bg-slate-100", activeText: "text-slate-800" },
        emerald: { activeBg: "bg-emerald-100", activeText: "text-emerald-700" },
        amber: { activeBg: "bg-amber-100", activeText: "text-amber-700" },
        orange: { activeBg: "bg-orange-100", activeText: "text-orange-700" },
        green: { activeBg: "bg-green-100", activeText: "text-green-700" },
        red: { activeBg: "bg-red-100", activeText: "text-red-700" },
        rose: { activeBg: "bg-rose-100", activeText: "text-rose-700" },
        purple: { activeBg: "bg-purple-100", activeText: "text-purple-700" },
    };
    const c = colorMap[color] || colorMap.slate;

    return (
        <Link href={href}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${active ? `${c.activeBg} ${c.activeText}` : 'text-slate-500 hover:bg-slate-50'
                }`}
        >
            {icon && <span className="mr-1 inline-block align-text-bottom">{icon}</span>}
            {label}
        </Link>
    );
}
