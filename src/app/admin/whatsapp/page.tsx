import Link from "next/link";
import { redirect } from "next/navigation";
import {
    AlertTriangle,
    ArrowUpRight,
    MessageSquareMore,
    Search,
    Send,
    UserRoundSearch,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import AdminWhatsAppSeenTracker from "@/components/admin/AdminWhatsAppSeenTracker";
import AdminSectionHero from "@/components/admin/AdminSectionHero";
import {
    isAdminWhatsAppIdentityRiskThread,
    isAdminWhatsAppOpsTriageThread,
    isAdminWhatsAppRecentThread,
    isAdminWhatsAppUnreadThread,
    isAdminWhatsAppWaitingOnUsThread,
    loadAdminWhatsAppOverview,
    loadAdminWhatsAppThreadMessages,
    type AdminWhatsAppIdentityState,
    type AdminWhatsAppParticipantRole,
    type AdminWhatsAppThreadSummary,
} from "@/lib/admin-whatsapp";
import { normalizeUserType } from "@/lib/domain";
import { isGodModeUser } from "@/lib/godmode";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SearchParamValue = string | string[] | undefined;
type AdminWhatsAppSavedView = "all_threads" | "unread" | "ops_triage" | "identity_risk" | "failed_recent" | "recent_active";
type AdminWhatsAppFilter =
    | "all"
    | "worker"
    | "employer"
    | "agency"
    | "admin"
    | "anonymous"
    | "failed"
    | "phone_match"
    | "unlinked"
    | "mixed"
    | "templates";

const FILTER_OPTIONS: AdminWhatsAppFilter[] = [
    "all",
    "worker",
    "employer",
    "agency",
    "admin",
    "anonymous",
    "failed",
    "phone_match",
    "unlinked",
    "mixed",
    "templates",
];
const SAVED_VIEW_OPTIONS: AdminWhatsAppSavedView[] = [
    "all_threads",
    "unread",
    "ops_triage",
    "identity_risk",
    "failed_recent",
    "recent_active",
];
const THREADS_PER_PAGE = 40;

function getSingleSearchParam(value: SearchParamValue): string | null {
    if (Array.isArray(value)) {
        return value[0] || null;
    }

    return value || null;
}

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

function formatDateTime(value: string | null | undefined) {
    if (!value) {
        return "No timestamp";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return "No timestamp";
    }

    return parsed.toLocaleString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function roleChipClasses(role: AdminWhatsAppParticipantRole) {
    switch (role) {
        case "worker":
            return "bg-emerald-100 text-emerald-700";
        case "employer":
            return "bg-blue-100 text-blue-700";
        case "agency":
            return "bg-violet-100 text-violet-700";
        case "admin":
            return "bg-amber-100 text-amber-700";
        default:
            return "bg-slate-100 text-slate-700";
    }
}

function roleLabel(role: AdminWhatsAppParticipantRole) {
    switch (role) {
        case "worker":
            return "Worker";
        case "employer":
            return "Employer";
        case "agency":
            return "Agency";
        case "admin":
            return "Admin";
        default:
            return "Anonymous";
    }
}

function identityStateLabel(state: AdminWhatsAppIdentityState) {
    switch (state) {
        case "linked":
            return "Linked";
        case "phone_match":
            return "Phone match";
        default:
            return "Unlinked";
    }
}

function savedViewLabel(view: AdminWhatsAppSavedView) {
    switch (view) {
        case "unread":
            return "Unread";
        case "ops_triage":
            return "Ops Triage";
        case "identity_risk":
            return "Identity Risk";
        case "failed_recent":
            return "Failed 7d";
        case "recent_active":
            return "Recent 7d";
        default:
            return "All Threads";
    }
}

function savedViewDescription(view: AdminWhatsAppSavedView) {
    switch (view) {
        case "unread":
            return "Latest inbound messages that still have not been opened in this admin session.";
        case "ops_triage":
            return "Failures or identity drift that likely need human review.";
        case "identity_risk":
            return "Phone-only, unlinked, or partially linked conversation history.";
        case "failed_recent":
            return "Threads with outbound failures and recent activity in the last 7 days.";
        case "recent_active":
            return "Latest thread activity in the last 7 days.";
        default:
            return "Full WhatsApp history across every linked and unlinked phone.";
    }
}

function filterLabel(filter: AdminWhatsAppFilter) {
    switch (filter) {
        case "worker":
            return "Workers";
        case "employer":
            return "Employers";
        case "agency":
            return "Agencies";
        case "admin":
            return "Admin";
        case "anonymous":
            return "Role Unknown";
        case "failed":
            return "Failed";
        case "phone_match":
            return "Phone Match";
        case "unlinked":
            return "Unlinked";
        case "mixed":
            return "Mixed Link";
        case "templates":
            return "Templates";
        default:
            return "All";
    }
}

function matchesFilter(thread: AdminWhatsAppThreadSummary, filter: AdminWhatsAppFilter) {
    if (filter === "all") {
        return true;
    }

    if (filter === "failed") {
        return thread.failedCount > 0;
    }

    if (filter === "phone_match") {
        return thread.identityState === "phone_match";
    }

    if (filter === "unlinked") {
        return thread.identityState === "unlinked";
    }

    if (filter === "mixed") {
        return thread.hasIdentityDrift || (thread.identityState === "linked" && thread.hasUnlinkedMessages);
    }

    if (filter === "templates") {
        return thread.templateCount > 0;
    }

    return thread.participantRole === filter;
}

function matchesSavedView(thread: AdminWhatsAppThreadSummary, view: AdminWhatsAppSavedView, referenceTime: Date) {
    switch (view) {
        case "unread":
            return isAdminWhatsAppUnreadThread(thread);
        case "ops_triage":
            return isAdminWhatsAppOpsTriageThread(thread);
        case "identity_risk":
            return isAdminWhatsAppIdentityRiskThread(thread);
        case "failed_recent":
            return thread.failedCount > 0 && isAdminWhatsAppRecentThread(thread, referenceTime, 7);
        case "recent_active":
            return isAdminWhatsAppRecentThread(thread, referenceTime, 7);
        default:
            return true;
    }
}

function parsePage(value: string | null) {
    if (!value) {
        return 1;
    }

    const page = Number.parseInt(value, 10);
    return Number.isFinite(page) && page > 0 ? page : 1;
}

function clampPage(page: number, totalPages: number) {
    if (totalPages <= 0) {
        return 1;
    }

    return Math.min(Math.max(page, 1), totalPages);
}

function getSavedView(value: string | null): AdminWhatsAppSavedView {
    if (value && SAVED_VIEW_OPTIONS.includes(value as AdminWhatsAppSavedView)) {
        return value as AdminWhatsAppSavedView;
    }

    return "all_threads";
}

function buildHref(
    current: {
        view: AdminWhatsAppSavedView;
        filter: AdminWhatsAppFilter;
        q: string;
        phone: string | null;
        page: number;
    },
    patch: Partial<{
        view: AdminWhatsAppSavedView;
        filter: AdminWhatsAppFilter;
        q: string;
        phone: string | null;
        page: number;
    }>
) {
    const params = new URLSearchParams();
    const nextView = patch.view ?? current.view;
    const nextFilter = patch.filter ?? current.filter;
    const nextQuery = patch.q ?? current.q;
    const nextPhone = patch.phone === undefined ? current.phone : patch.phone;
    const nextPage = patch.page ?? current.page;

    if (nextView !== "all_threads") {
        params.set("view", nextView);
    }

    if (nextFilter !== "all") {
        params.set("filter", nextFilter);
    }

    if (nextQuery.trim()) {
        params.set("q", nextQuery.trim());
    }

    if (nextPhone) {
        params.set("phone", nextPhone);
    }

    if (nextPage > 1) {
        params.set("page", String(nextPage));
    }

    const query = params.toString();
    return query ? `/admin/whatsapp?${query}` : "/admin/whatsapp";
}

function caseActionLabel(thread: AdminWhatsAppThreadSummary) {
    if (!thread.caseHref) {
        return null;
    }

    switch (thread.participantRole) {
        case "worker":
            return "Open case";
        case "employer":
            return "Open employers";
        case "agency":
            return "Open agencies";
        default:
            return null;
    }
}

export default async function AdminWhatsAppPage({
    searchParams,
}: {
    searchParams: Promise<{
        view?: SearchParamValue;
        filter?: SearchParamValue;
        q?: SearchParamValue;
        phone?: SearchParamValue;
        page?: SearchParamValue;
    }>;
}) {
    const user = await ensureAdminUser();
    const resolvedSearchParams = await searchParams;
    const admin = createAdminClient();
    const { threads, totalMessages } = await loadAdminWhatsAppOverview(admin, { adminProfileId: user.id });
    const now = new Date();

    const view = getSavedView(getSingleSearchParam(resolvedSearchParams.view));
    const rawFilter = getSingleSearchParam(resolvedSearchParams.filter);
    const filter: AdminWhatsAppFilter = FILTER_OPTIONS.includes((rawFilter || "") as AdminWhatsAppFilter)
        ? (rawFilter as AdminWhatsAppFilter)
        : "all";
    const q = (getSingleSearchParam(resolvedSearchParams.q) || "").trim();
    const selectedPhone = getSingleSearchParam(resolvedSearchParams.phone);
    const requestedPage = parsePage(getSingleSearchParam(resolvedSearchParams.page));
    const filteredThreads = threads.filter((thread) => {
        if (!matchesSavedView(thread, view, now)) {
            return false;
        }

        if (!matchesFilter(thread, filter)) {
            return false;
        }

        if (!q) {
            return true;
        }

        return thread.searchText.includes(q.toLowerCase());
    });

    const totalPages = Math.max(1, Math.ceil(filteredThreads.length / THREADS_PER_PAGE));
    const selectedIndex = selectedPhone
        ? filteredThreads.findIndex((thread) => thread.phoneNumber === selectedPhone)
        : -1;
    const pageFromSelection = selectedIndex >= 0
        ? Math.floor(selectedIndex / THREADS_PER_PAGE) + 1
        : null;
    const currentPage = clampPage(pageFromSelection ?? requestedPage, totalPages);
    const pageStartIndex = (currentPage - 1) * THREADS_PER_PAGE;
    const pageThreads = filteredThreads.slice(pageStartIndex, pageStartIndex + THREADS_PER_PAGE);
    const activeThread = (selectedPhone
        ? filteredThreads.find((thread) => thread.phoneNumber === selectedPhone)
        : null) || pageThreads[0] || null;
    const activePhone = activeThread?.phoneNumber || null;
    const currentQueryState = { view, filter, q, phone: activePhone, page: currentPage };
    const activeMessages = activeThread
        ? activeThread.messages.length > 0
            ? activeThread.messages
            : await loadAdminWhatsAppThreadMessages(admin, activeThread.phoneNumber)
        : [];
    const pageStartDisplay = filteredThreads.length === 0 ? 0 : pageStartIndex + 1;
    const pageEndDisplay = filteredThreads.length === 0 ? 0 : Math.min(pageStartIndex + pageThreads.length, filteredThreads.length);

    const linkedThreads = threads.filter((thread) => thread.identityState === "linked").length;
    const phoneMatchThreads = threads.filter((thread) => thread.identityState === "phone_match").length;
    const unlinkedThreads = threads.filter((thread) => thread.identityState === "unlinked").length;
    const mixedThreads = threads.filter((thread) => isAdminWhatsAppIdentityRiskThread(thread) && thread.identityState === "linked").length;
    const unreadThreads = threads.filter((thread) => isAdminWhatsAppUnreadThread(thread)).length;
    const opsTriageThreads = threads.filter((thread) => isAdminWhatsAppOpsTriageThread(thread)).length;
    const identityRiskThreads = threads.filter((thread) => isAdminWhatsAppIdentityRiskThread(thread)).length;
    const recentFailedThreads = threads.filter((thread) => thread.failedCount > 0 && isAdminWhatsAppRecentThread(thread, now, 7)).length;
    const recentActiveThreads = threads.filter((thread) => isAdminWhatsAppRecentThread(thread, now, 7)).length;
    const failedMessages = threads.reduce((sum, thread) => sum + thread.failedCount, 0);

    return (
        <AppShell user={user} variant="admin">
            <div className="space-y-6">
                <AdminSectionHero
                    eyebrow="Admin WhatsApp"
                    title="WhatsApp Conversations"
                    description="Review every WhatsApp transcript in one place, jump into the linked worker workspace or case when we know who is behind the phone, and catch failed or unlinked threads before they disappear into ops noise."
                    metrics={[
                        { label: "Threads", value: threads.length, meta: `${filteredThreads.length} in current view` },
                        { label: "Messages", value: totalMessages, meta: "Full whatsapp_messages log" },
                        { label: "Linked", value: linkedThreads, meta: "Profile-linked threads" },
                        { label: "Unread", value: unreadThreads, meta: "Inbound since your last open" },
                        { label: "Phone Match", value: phoneMatchThreads, meta: "Matched only by phone" },
                        { label: "Unlinked", value: unlinkedThreads, meta: "Still phone-only" },
                        { label: "Mixed", value: mixedThreads, meta: "Partial or conflicting identity history" },
                        { label: "Failed Msg", value: failedMessages, meta: "Outbound issues in log" },
                    ]}
                />

                <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
                    <div className="space-y-4">
                        <div className="rounded-[24px] border border-[#e6e6e1] bg-white p-5 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
                            <div className="mb-4 flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#111111] text-white">
                                    <Search size={18} />
                                </div>
                                <div>
                                    <h2 className="text-base font-semibold text-[#18181b]">Find a thread</h2>
                                    <p className="text-sm text-[#71717a]">Search by phone, name, email, or latest preview.</p>
                                </div>
                            </div>

                            <form action="/admin/whatsapp" method="get" className="space-y-3">
                                <input type="hidden" name="view" value={view} />
                                <input type="hidden" name="filter" value={filter} />
                                <label className="block">
                                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#8a8479]">Search</span>
                                    <input
                                        type="text"
                                        name="q"
                                        defaultValue={q}
                                        placeholder="Phone, worker, employer..."
                                        className="w-full rounded-2xl border border-[#e7e5df] bg-[#faf8f3] px-4 py-3 text-sm text-[#18181b] outline-none transition focus:border-[#cfc8bb] focus:bg-white"
                                    />
                                </label>
                                <div className="flex gap-2">
                                    <button
                                        type="submit"
                                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#111111] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#27272a]"
                                    >
                                        <Search size={15} />
                                        Apply
                                    </button>
                                    {q ? (
                                        <Link
                                            href={buildHref(currentQueryState, { q: "", phone: null, page: 1 })}
                                            className="inline-flex items-center justify-center rounded-2xl border border-[#e6e6e1] bg-white px-4 py-3 text-sm font-semibold text-[#57534e] transition hover:border-[#d7d0c6] hover:text-[#18181b]"
                                        >
                                            Reset
                                        </Link>
                                    ) : null}
                                </div>
                            </form>

                            <div className="mt-4 flex flex-wrap gap-1.5">
                                {SAVED_VIEW_OPTIONS.map((option) => {
                                    const isActive = option === view;
                                    const count = option === "ops_triage"
                                        ? opsTriageThreads
                                        : option === "unread"
                                            ? unreadThreads
                                            : option === "identity_risk"
                                                ? identityRiskThreads
                                                : option === "failed_recent"
                                                    ? recentFailedThreads
                                                    : option === "recent_active"
                                                        ? recentActiveThreads
                                                        : threads.length;

                                    return (
                                        <Link
                                            key={option}
                                            href={buildHref(currentQueryState, { view: option, phone: null, page: 1 })}
                                            className={`rounded-[18px] border px-3 py-2 text-left transition ${
                                                isActive
                                                    ? "border-[#111111] bg-[#111111] text-white"
                                                    : "border-[#ece7de] bg-[#faf8f3] text-[#57534e] hover:bg-white hover:text-[#18181b]"
                                            }`}
                                        >
                                            <div className="text-[11px] font-semibold uppercase tracking-[0.16em]">
                                                {savedViewLabel(option)}
                                            </div>
                                            <div className={`mt-1 text-lg font-semibold ${isActive ? "text-white" : "text-[#18181b]"}`}>
                                                {count}
                                            </div>
                                            <div className={`mt-1 max-w-[190px] text-[11px] leading-relaxed ${isActive ? "text-white/75" : "text-[#71717a]"}`}>
                                                {savedViewDescription(option)}
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>

                            <div className="mt-4 flex flex-wrap gap-1.5">
                                {FILTER_OPTIONS.map((option) => {
                                    const isActive = option === filter;
                                    return (
                                        <Link
                                            key={option}
                                            href={buildHref(currentQueryState, { filter: option, phone: null, page: 1 })}
                                            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                                                isActive
                                                    ? "bg-[#111111] text-white"
                                                    : "bg-[#faf8f3] text-[#57534e] hover:bg-white hover:text-[#18181b] border border-[#ece7de]"
                                            }`}
                                        >
                                            {filterLabel(option)}
                                        </Link>
                                    );
                                })}
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-2">
                                <div className="rounded-2xl border border-[#ebe7df] bg-[#faf8f3] px-4 py-3">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a8479]">Failed Threads</div>
                                    <div className="mt-1 text-xl font-semibold text-[#18181b]">{threads.filter((thread) => thread.failedCount > 0).length}</div>
                                </div>
                                <div className="rounded-2xl border border-[#ebe7df] bg-[#faf8f3] px-4 py-3">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a8479]">Current View</div>
                                    <div className="mt-1 text-xl font-semibold text-[#18181b]">{filteredThreads.length}</div>
                                </div>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-2">
                                <Link
                                    href={buildHref(currentQueryState, { filter: "phone_match", phone: null, page: 1 })}
                                    className="rounded-2xl border border-[#ebe7df] bg-[#faf8f3] px-4 py-3 text-left transition hover:border-[#d7d0c6] hover:bg-white"
                                >
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a8479]">Phone Match</div>
                                    <div className="mt-1 text-xl font-semibold text-[#18181b]">{phoneMatchThreads}</div>
                                </Link>
                                <Link
                                    href={buildHref(currentQueryState, { filter: "mixed", phone: null, page: 1 })}
                                    className="rounded-2xl border border-[#ebe7df] bg-[#faf8f3] px-4 py-3 text-left transition hover:border-[#d7d0c6] hover:bg-white"
                                >
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a8479]">Mixed Link</div>
                                    <div className="mt-1 text-xl font-semibold text-[#18181b]">{mixedThreads}</div>
                                </Link>
                            </div>
                        </div>

                        <div className="rounded-[24px] border border-[#e6e6e1] bg-white p-5 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <div>
                                    <h2 className="text-base font-semibold text-[#18181b]">Conversation list</h2>
                                    <p className="text-sm text-[#71717a]">
                                        Showing {pageStartDisplay}-{pageEndDisplay} of {filteredThreads.length} thread{filteredThreads.length === 1 ? "" : "s"}
                                    </p>
                                </div>
                                <div className="rounded-full border border-[#ebe7df] bg-[#faf8f3] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b675d]">
                                    {savedViewLabel(view)} · Page {currentPage} / {totalPages}
                                </div>
                            </div>

                            {filteredThreads.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-[#ddd6cb] bg-[#faf8f3] px-4 py-6 text-sm text-[#71717a]">
                                    No conversations match this filter yet.
                                </div>
                            ) : (
                                <div className="space-y-2 xl:max-h-[70vh] xl:overflow-y-auto xl:pr-1">
                                    {pageThreads.map((thread) => {
                                        const isActive = thread.phoneNumber === activePhone;
                                        return (
                                            <Link
                                                key={thread.phoneNumber}
                                                href={buildHref(currentQueryState, { phone: thread.phoneNumber })}
                                                className={`block rounded-[20px] border px-4 py-3 transition ${
                                                    isActive
                                                        ? "border-[#111111] bg-[#f7f5ef] shadow-[0_18px_35px_-32px_rgba(15,23,42,0.45)]"
                                                        : thread.hasUnread
                                                            ? "border-emerald-200 bg-emerald-50/40 hover:border-emerald-300 hover:bg-emerald-50/60"
                                                            : "border-[#ece8df] bg-white hover:border-[#d8d1c6] hover:bg-[#faf8f3]"
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <div className="truncate text-sm font-semibold text-[#18181b]">{thread.participantName}</div>
                                                            {thread.hasUnread ? <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" /> : null}
                                                        </div>
                                                        <div className="mt-0.5 truncate text-xs text-[#71717a]">{thread.phoneNumber}</div>
                                                    </div>
                                                    <div className="shrink-0 text-[11px] font-medium text-[#8a8479]">
                                                        {formatDateTime(thread.latestAt)}
                                                    </div>
                                                </div>

                                                <div className="mt-3 flex flex-wrap gap-1.5">
                                                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${roleChipClasses(thread.participantRole)}`}>
                                                        {roleLabel(thread.participantRole)}
                                                    </span>
                                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                                                        {identityStateLabel(thread.identityState)}
                                                    </span>
                                                    {thread.failedCount > 0 ? (
                                                        <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-semibold text-rose-700">
                                                            {thread.failedCount} failed
                                                        </span>
                                                    ) : null}
                                                    {thread.hasUnread ? (
                                                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                                                            Unread
                                                        </span>
                                                    ) : null}
                                                    {!thread.hasUnread && isAdminWhatsAppWaitingOnUsThread(thread) ? (
                                                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                                                            Waiting on us
                                                        </span>
                                                    ) : null}
                                                    {thread.hasIdentityDrift ? (
                                                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                                                            Mixed link
                                                        </span>
                                                    ) : null}
                                                </div>

                                                <p className={`mt-3 line-clamp-2 text-sm leading-relaxed ${thread.hasUnread ? "font-medium text-[#18181b]" : "text-[#57534e]"}`}>
                                                    {thread.latestPreview}
                                                </p>

                                                <div className="mt-3 flex items-center justify-between text-[11px] font-medium text-[#8a8479]">
                                                    <span>{thread.messageCount} message{thread.messageCount === 1 ? "" : "s"}</span>
                                                    <span>{thread.inboundCount} in / {thread.outboundCount} out</span>
                                                </div>
                                            </Link>
                                        );
                                    })}

                                    {totalPages > 1 ? (
                                        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-[#ebe7df] bg-[#faf8f3] px-4 py-3">
                                            <Link
                                                href={buildHref(currentQueryState, { page: Math.max(1, currentPage - 1), phone: null })}
                                                className={`inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold transition ${
                                                    currentPage === 1
                                                        ? "pointer-events-none bg-[#f1eee7] text-[#b2aba0]"
                                                        : "bg-white text-[#18181b] hover:border-[#d7d0c6] hover:bg-white"
                                                }`}
                                            >
                                                Previous
                                            </Link>
                                            <div className="text-center text-xs font-medium text-[#6b675d]">
                                                Page {currentPage} of {totalPages}
                                            </div>
                                            <Link
                                                href={buildHref(currentQueryState, { page: Math.min(totalPages, currentPage + 1), phone: null })}
                                                className={`inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold transition ${
                                                    currentPage === totalPages
                                                        ? "pointer-events-none bg-[#f1eee7] text-[#b2aba0]"
                                                        : "bg-white text-[#18181b] hover:border-[#d7d0c6] hover:bg-white"
                                                }`}
                                            >
                                                Next
                                            </Link>
                                        </div>
                                    ) : null}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="space-y-4">
                        {activeThread ? (
                            <>
                                <AdminWhatsAppSeenTracker
                                    enabled={selectedPhone === activeThread.phoneNumber}
                                    phoneNumber={activeThread.phoneNumber}
                                    latestAt={activeThread.latestAt}
                                    latestDirection={activeThread.latestDirection}
                                />
                                <div className="rounded-[24px] border border-[#e6e6e1] bg-white p-5 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="min-w-0">
                                            <div className="mb-3 inline-flex items-center rounded-full border border-[#dfdbd0] bg-[#faf8f3] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6b675d]">
                                                Selected thread
                                            </div>
                                            <h2 className="truncate text-2xl font-semibold tracking-tight text-[#18181b]">{activeThread.participantName}</h2>
                                            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[#57534e]">
                                                <span>{activeThread.phoneNumber}</span>
                                                {activeThread.participantEmail ? <span>- {activeThread.participantEmail}</span> : null}
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            {activeThread.workspaceHref ? (
                                                <Link
                                                    href={activeThread.workspaceHref}
                                                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#d8d1c6] bg-white px-4 py-2.5 text-sm font-semibold text-[#18181b] transition hover:border-[#111111]"
                                                >
                                                    <UserRoundSearch size={15} />
                                                    Inspect workspace
                                                </Link>
                                            ) : null}
                                            {caseActionLabel(activeThread) && activeThread.caseHref ? (
                                                <Link
                                                    href={activeThread.caseHref}
                                                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#111111] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#27272a]"
                                                >
                                                    <ArrowUpRight size={15} />
                                                    {caseActionLabel(activeThread)}
                                                </Link>
                                            ) : null}
                                        </div>
                                    </div>

                                    <div className="mt-4 flex flex-wrap gap-2">
                                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${roleChipClasses(activeThread.participantRole)}`}>
                                            {roleLabel(activeThread.participantRole)}
                                        </span>
                                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                                            {identityStateLabel(activeThread.identityState)}
                                        </span>
                                        {activeThread.failedCount > 0 ? (
                                            <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-semibold text-rose-700">
                                                {activeThread.failedCount} failed message{activeThread.failedCount === 1 ? "" : "s"}
                                            </span>
                                        ) : null}
                                        {activeThread.templateCount > 0 ? (
                                            <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                                                {activeThread.templateCount} template
                                            </span>
                                        ) : null}
                                        {activeThread.hasUnread ? (
                                            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                                                Unread
                                            </span>
                                        ) : null}
                                        {!activeThread.hasUnread && activeThread.waitingOnUs ? (
                                            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                                                Waiting on us
                                            </span>
                                        ) : null}
                                        {!activeThread.hasUnread && !activeThread.waitingOnUs && activeThread.lastSeenAt ? (
                                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                                                Seen {formatDateTime(activeThread.lastSeenAt)}
                                            </span>
                                        ) : null}
                                        {activeThread.hasIdentityDrift ? (
                                            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                                                Multiple linked profiles
                                            </span>
                                        ) : null}
                                    </div>

                                    {(activeThread.identityState !== "linked" || activeThread.hasIdentityDrift || activeThread.hasUnlinkedMessages) ? (
                                        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                            <div className="flex items-start gap-2">
                                                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                                                <div className="space-y-1">
                                                    {activeThread.identityState === "phone_match" ? (
                                                        <p>This thread is matched by phone only. Some rows are still missing a hard profile link in `whatsapp_messages.user_id`.</p>
                                                    ) : null}
                                                    {activeThread.identityState === "unlinked" ? (
                                                        <p>This phone is still not linked to any known worker, employer, agency, or admin profile.</p>
                                                    ) : null}
                                                    {activeThread.hasIdentityDrift ? (
                                                        <p>More than one profile touched this phone across message history, so review the transcript carefully before acting.</p>
                                                    ) : null}
                                                    {activeThread.hasUnlinkedMessages && activeThread.identityState === "linked" ? (
                                                        <p>Some older rows were logged before identity attachment, so the thread is only partially linked.</p>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>

                                <div className="rounded-[24px] border border-[#e6e6e1] bg-white p-5 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
                                    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <h3 className="text-lg font-semibold text-[#18181b]">Transcript</h3>
                                            <p className="text-sm text-[#71717a]">{activeThread.messageCount} message{activeThread.messageCount === 1 ? "" : "s"} in this thread</p>
                                        </div>
                                        <div className="rounded-full border border-[#ebe7df] bg-[#faf8f3] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b675d]">
                                            Thread-only transcript
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        {activeMessages.map((message) => {
                                            const isInbound = message.direction === "inbound";
                                            return (
                                                <div
                                                    key={message.id}
                                                    className={`flex ${isInbound ? "justify-start" : "justify-end"}`}
                                                >
                                                    <div
                                                        className={`max-w-[92%] rounded-[20px] border px-4 py-3 sm:max-w-[80%] ${
                                                            isInbound
                                                                ? "border-[#e6e6e1] bg-[#faf8f3] text-[#18181b]"
                                                                : message.status === "failed"
                                                                    ? "border-rose-200 bg-rose-50 text-rose-900"
                                                                    : "border-blue-200 bg-blue-50 text-blue-900"
                                                        }`}
                                                    >
                                                        <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]">
                                                            <span className={isInbound ? "text-[#8a8479]" : message.status === "failed" ? "text-rose-700" : "text-blue-700"}>
                                                                {isInbound ? "Inbound" : "Outbound"}
                                                            </span>
                                                            {message.templateName ? (
                                                                <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] tracking-normal text-[#57534e]">
                                                                    {message.templateName}
                                                                </span>
                                                            ) : null}
                                                            {message.messageType && message.messageType !== "text" ? (
                                                                <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] tracking-normal text-[#57534e]">
                                                                    {message.messageType}
                                                                </span>
                                                            ) : null}
                                                            {message.status ? (
                                                                <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] tracking-normal text-[#57534e]">
                                                                    {message.status}
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                        <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                                                            {(message.content || "").trim() || message.preview}
                                                        </div>
                                                        <div className="mt-3 text-[11px] font-medium text-[#8a8479]">
                                                            {formatDateTime(message.createdAt)}
                                                        </div>
                                                        {message.errorMessage ? (
                                                            <div className="mt-2 rounded-2xl border border-rose-200 bg-white/80 px-3 py-2 text-xs text-rose-800">
                                                                <span className="font-semibold">Error:</span> {message.errorMessage}
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="rounded-[24px] border border-dashed border-[#d9d2c5] bg-white p-10 text-center shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
                                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f3f0ea] text-[#6b675d]">
                                    <MessageSquareMore size={24} />
                                </div>
                                <h2 className="mt-4 text-xl font-semibold text-[#18181b]">No conversations in this view</h2>
                                <p className="mt-2 text-sm text-[#71717a]">
                                    Try a different filter, clear the search query, or wait for the next WhatsApp event to hit the log.
                                </p>
                            </div>
                        )}

                        <div className="grid gap-4 lg:grid-cols-2">
                            <div className="rounded-[24px] border border-[#e6e6e1] bg-white p-5 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
                                <div className="mb-3 flex items-center gap-3">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                                        <Send size={18} />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-semibold text-[#18181b]">Need a proactive nudge?</h3>
                                        <p className="text-sm text-[#71717a]">Open the controlled WhatsApp blast tool for payment-ready workers.</p>
                                    </div>
                                </div>
                                <Link
                                    href="/admin/whatsapp-blast"
                                    className="inline-flex items-center gap-2 rounded-2xl bg-[#111111] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#27272a]"
                                >
                                    <ArrowUpRight size={15} />
                                    Open WA Blast
                                </Link>
                            </div>

                            <div className="rounded-[24px] border border-[#e6e6e1] bg-white p-5 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
                                <div className="mb-3 flex items-center gap-3">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                                        <MessageSquareMore size={18} />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-semibold text-[#18181b]">Need in-platform follow-up?</h3>
                                        <p className="text-sm text-[#71717a]">Support handoffs still live in the admin inbox, separate from raw WhatsApp transcripts.</p>
                                    </div>
                                </div>
                                <Link
                                    href="/admin/inbox"
                                    className="inline-flex items-center gap-2 rounded-2xl border border-[#d8d1c6] bg-white px-4 py-2.5 text-sm font-semibold text-[#18181b] transition hover:border-[#111111]"
                                >
                                    <ArrowUpRight size={15} />
                                    Open Inbox
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </AppShell>
    );
}
