import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/database.types";
import { normalizeUserType, type CanonicalUserType } from "@/lib/domain";
import { pickCanonicalEmployerRecord, type EmployerRecordSnapshot } from "@/lib/employers";
import { truncateWhatsAppPreview } from "@/lib/whatsapp-conversation-helpers";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp-inbound-events";
import { pickCanonicalWorkerRecord, type WorkerRecordSnapshot } from "@/lib/workers";

type AdminDbClient = SupabaseClient<Database>;
type WhatsAppMessageRow = Tables<"whatsapp_messages">;
type ProfileRow = Pick<Tables<"profiles">, "id" | "full_name" | "email" | "user_type">;
type AgencyRow = Pick<Tables<"agencies">, "id" | "profile_id" | "display_name" | "legal_name" | "contact_email" | "contact_phone">;
type AdminWhatsAppQueryError = {
    code?: string;
    message?: string | null;
} | null;

type AdminWhatsAppQueryResponse<TData = unknown> = {
    data?: TData | null;
    count?: number | null;
    error?: AdminWhatsAppQueryError;
};

type AdminWhatsAppQueryChain<TData = unknown> = PromiseLike<AdminWhatsAppQueryResponse<TData>> & {
    select: (...args: unknown[]) => AdminWhatsAppQueryChain<TData>;
    eq: (...args: unknown[]) => AdminWhatsAppQueryChain<TData>;
    order: (...args: unknown[]) => AdminWhatsAppQueryChain<TData>;
    range: (...args: unknown[]) => AdminWhatsAppQueryChain<TData>;
    maybeSingle: () => PromiseLike<AdminWhatsAppQueryResponse<TData>>;
    upsert: (...args: unknown[]) => AdminWhatsAppQueryChain<TData>;
};

function adminWhatsAppTable<TData = unknown>(admin: AdminDbClient, table: string) {
    return admin.from(table as never) as unknown as AdminWhatsAppQueryChain<TData>;
}

interface WorkerRow extends WorkerRecordSnapshot {
    id?: string | null;
    profile_id?: string | null;
    agency_id?: string | null;
    submitted_email?: string | null;
    submitted_full_name?: string | null;
    phone?: string | null;
    status?: string | null;
}

interface EmployerRow extends EmployerRecordSnapshot {
    profile_id?: string | null;
    company_name?: string | null;
    contact_email?: string | null;
    contact_phone?: string | null;
}

interface AdminWhatsAppThreadSummaryRow {
    phone_number: string;
    latest_at: string | null;
    latest_direction: string | null;
    latest_status: string | null;
    latest_preview: string | null;
    latest_template_name: string | null;
    latest_message_type: string | null;
    message_count: number | string | null;
    inbound_count: number | string | null;
    outbound_count: number | string | null;
    failed_count: number | string | null;
    template_count: number | string | null;
    has_unlinked_messages: boolean | null;
    linked_profile_ids: string[] | null;
}

interface AdminWhatsAppMessageLogRow {
    id: string;
    normalized_phone_number: string;
    direction: string;
    content: string | null;
    created_at: string | null;
    status: string | null;
    message_type: string | null;
    template_name: string | null;
    error_message: string | null;
    preview: string | null;
}

export type AdminWhatsAppParticipantRole = CanonicalUserType | "anonymous";
export type AdminWhatsAppIdentityState = "linked" | "phone_match" | "unlinked";

interface IdentityCandidate {
    role: AdminWhatsAppParticipantRole;
    label: string;
    name: string;
    email: string | null;
    profileId: string | null;
    workerId: string | null;
    caseHref: string | null;
    workspaceHref: string | null;
}

export interface AdminWhatsAppMessageView {
    id: string;
    direction: string;
    content: string | null;
    createdAt: string | null;
    status: string | null;
    messageType: string | null;
    templateName: string | null;
    errorMessage: string | null;
    preview: string;
}

export interface AdminWhatsAppThreadSummary {
    phoneNumber: string;
    participantName: string;
    participantLabel: string;
    participantRole: AdminWhatsAppParticipantRole;
    participantEmail: string | null;
    identityState: AdminWhatsAppIdentityState;
    linkedProfileIds: string[];
    hasIdentityDrift: boolean;
    hasUnlinkedMessages: boolean;
    latestAt: string | null;
    latestDirection: string;
    latestStatus: string | null;
    latestPreview: string;
    latestTemplateName: string | null;
    latestMessageType: string | null;
    messageCount: number;
    inboundCount: number;
    outboundCount: number;
    failedCount: number;
    templateCount: number;
    lastSeenAt: string | null;
    hasUnread: boolean;
    waitingOnUs: boolean;
    caseHref: string | null;
    workspaceHref: string | null;
    workerId: string | null;
    searchText: string;
    messages: AdminWhatsAppMessageView[];
}

export interface AdminWhatsAppOverview {
    threads: AdminWhatsAppThreadSummary[];
    totalMessages: number;
}

type AdminWhatsAppRiskThread = Pick<
    AdminWhatsAppThreadSummary,
    "failedCount" | "identityState" | "hasIdentityDrift" | "hasUnlinkedMessages" | "latestAt" | "latestDirection" | "hasUnread"
>;

interface AdminWhatsAppThreadViewRow {
    phone_number: string;
    last_seen_at: string | null;
}

interface AdminWhatsAppThreadViewRecord {
    last_seen_at: string | null;
}

export interface AdminWhatsAppThreadSeenResult {
    changed: boolean;
    unsupported: boolean;
    lastSeenAt: string | null;
}

interface BuildAdminWhatsAppThreadsParams {
    messages: WhatsAppMessageRow[];
    profiles: ProfileRow[];
    workers: WorkerRow[];
    employers: EmployerRow[];
    agencies: AgencyRow[];
}

interface MutableThreadSummary {
    phoneNumber: string;
    latestAt: string | null;
    latestDirection: string;
    latestStatus: string | null;
    latestPreview: string;
    latestTemplateName: string | null;
    latestMessageType: string | null;
    messageCount: number;
    inboundCount: number;
    outboundCount: number;
    failedCount: number;
    templateCount: number;
    linkedProfileIds: Set<string>;
    hasUnlinkedMessages: boolean;
    messages: WhatsAppMessageRow[];
}

const FETCH_PAGE_SIZE = 1000;

function toTimestamp(value: string | null | undefined): number {
    if (!value) {
        return 0;
    }

    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

export function isAdminWhatsAppIdentityRiskThread(thread: AdminWhatsAppRiskThread) {
    return thread.identityState !== "linked"
        || thread.hasIdentityDrift
        || thread.hasUnlinkedMessages;
}

export function isAdminWhatsAppOpsTriageThread(thread: AdminWhatsAppRiskThread) {
    return thread.failedCount > 0 || isAdminWhatsAppIdentityRiskThread(thread);
}

export function isAdminWhatsAppUnreadThread(thread: Pick<AdminWhatsAppThreadSummary, "hasUnread">) {
    return thread.hasUnread;
}

export function isAdminWhatsAppWaitingOnUsThread(thread: Pick<AdminWhatsAppThreadSummary, "latestDirection">) {
    return thread.latestDirection === "inbound";
}

export function isAdminWhatsAppRecentThread(
    thread: Pick<AdminWhatsAppRiskThread, "latestAt">,
    referenceTime: Date,
    windowDays: number
) {
    const latestAt = toTimestamp(thread.latestAt);
    if (!latestAt) {
        return false;
    }

    const windowMs = windowDays * 24 * 60 * 60 * 1000;
    return latestAt >= referenceTime.getTime() - windowMs;
}

export function mergeAdminWhatsAppThreadViewState(
    threads: AdminWhatsAppThreadSummary[],
    threadViews: AdminWhatsAppThreadViewRow[]
): AdminWhatsAppThreadSummary[] {
    const threadViewsByPhone = new Map(
        threadViews
            .filter((row): row is AdminWhatsAppThreadViewRow => typeof row.phone_number === "string" && row.phone_number.trim().length > 0)
            .map((row) => [normalizePhone(row.phone_number), row] as const)
    );

    return threads.map((thread) => {
        const lastSeenAt = threadViewsByPhone.get(thread.phoneNumber)?.last_seen_at || null;
        const waitingOnUs = isAdminWhatsAppWaitingOnUsThread(thread);
        const hasUnread = waitingOnUs && (!lastSeenAt || toTimestamp(thread.latestAt) > toTimestamp(lastSeenAt));

        return {
            ...thread,
            lastSeenAt,
            hasUnread,
            waitingOnUs,
        };
    });
}

export async function markAdminWhatsAppThreadSeen(
    admin: AdminDbClient,
    params: {
        adminProfileId: string | null | undefined;
        phoneNumber: string;
        latestAt: string;
    }
): Promise<AdminWhatsAppThreadSeenResult> {
    const adminProfileId = params.adminProfileId?.trim() || null;
    const normalizedPhone = normalizePhone(params.phoneNumber);
    const latestAtTimestamp = toTimestamp(params.latestAt);
    if (!adminProfileId || !normalizedPhone || !latestAtTimestamp) {
        return {
            changed: false,
            unsupported: false,
            lastSeenAt: null,
        };
    }

    const latestAt = new Date(latestAtTimestamp).toISOString();
    const { data: existingRow, error: existingError } = await adminWhatsAppTable<AdminWhatsAppThreadViewRecord>(admin, "admin_whatsapp_thread_views")
        .select("last_seen_at")
        .eq("admin_profile_id", adminProfileId)
        .eq("phone_number", normalizedPhone)
        .maybeSingle();

    if (existingError) {
        if (isMissingAdminWhatsAppViewError(existingError)) {
            return {
                changed: false,
                unsupported: true,
                lastSeenAt: null,
            };
        }

        throw existingError;
    }

    const existingLastSeenAt = existingRow?.last_seen_at || null;
    if (existingLastSeenAt && toTimestamp(existingLastSeenAt) >= latestAtTimestamp) {
        return {
            changed: false,
            unsupported: false,
            lastSeenAt: existingLastSeenAt,
        };
    }

    const nowIso = new Date().toISOString();
    const { error: upsertError } = await adminWhatsAppTable(admin, "admin_whatsapp_thread_views").upsert(
        {
            admin_profile_id: adminProfileId,
            phone_number: normalizedPhone,
            last_seen_at: latestAt,
            updated_at: nowIso,
        },
        { onConflict: "admin_profile_id,phone_number" }
    );

    if (upsertError) {
        if (isMissingAdminWhatsAppViewError(upsertError)) {
            return {
                changed: false,
                unsupported: true,
                lastSeenAt: existingLastSeenAt,
            };
        }

        throw upsertError;
    }

    return {
        changed: true,
        unsupported: false,
        lastSeenAt: latestAt,
    };
}

function normalizePhone(value: string | null | undefined): string {
    if (!value) {
        return "";
    }

    return normalizeWhatsAppPhone(value);
}

function buildMessagePreview(message: Pick<WhatsAppMessageRow, "content" | "template_name" | "message_type">): string {
    const content = (message.content || "").trim();
    if (content) {
        return truncateWhatsAppPreview(content);
    }

    if (message.template_name) {
        return `Template: ${message.template_name}`;
    }

    if (message.message_type) {
        return `[${message.message_type}]`;
    }

    return "(no content)";
}

function toCount(value: number | string | null | undefined): number {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === "string" && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }

    return 0;
}

function isMissingAdminWhatsAppViewError(error: AdminWhatsAppQueryError) {
    const message = String(error?.message || "").toLowerCase();
    return error?.code === "42P01"
        || message.includes("does not exist")
        || message.includes("could not find the table")
        || message.includes("could not find the relation");
}

function buildWorkerCandidate(worker: WorkerRow, profile: ProfileRow | null, agency: AgencyRow | null): IdentityCandidate | null {
    const workerId = typeof worker.id === "string" && worker.id.trim() ? worker.id : null;
    const profileId = typeof worker.profile_id === "string" && worker.profile_id.trim() ? worker.profile_id : null;
    const name = profile?.full_name
        || worker.submitted_full_name
        || worker.submitted_email
        || profile?.email
        || worker.phone
        || "Worker";
    const email = profile?.email || worker.submitted_email || null;
    const label = worker.agency_id
        ? profileId
            ? "Agency worker"
            : "Agency draft worker"
        : "Worker";

    const caseHref = workerId ? `/admin/workers/${workerId}` : profileId ? `/admin/workers/${profileId}` : null;
    const workspaceHref = profileId
        ? `/profile/worker?inspect=${profileId}`
        : workerId && agency?.profile_id
            ? `/profile/agency/workers/${workerId}?inspect=${agency.profile_id}`
            : null;

    return {
        role: "worker",
        label,
        name,
        email,
        profileId,
        workerId,
        caseHref,
        workspaceHref,
    };
}

function buildEmployerCandidate(employer: EmployerRow, profile: ProfileRow | null): IdentityCandidate | null {
    const profileId = typeof employer.profile_id === "string" && employer.profile_id.trim() ? employer.profile_id : null;
    const name = employer.company_name || profile?.full_name || employer.contact_email || profile?.email || "Employer";
    const email = profile?.email || employer.contact_email || null;

    return {
        role: "employer",
        label: "Employer",
        name,
        email,
        profileId,
        workerId: null,
        caseHref: "/admin/employers",
        workspaceHref: profileId ? `/profile/employer?inspect=${profileId}` : null,
    };
}

function buildAgencyCandidate(agency: AgencyRow, profile: ProfileRow | null): IdentityCandidate | null {
    const profileId = typeof agency.profile_id === "string" && agency.profile_id.trim() ? agency.profile_id : null;
    const name = agency.display_name || agency.legal_name || profile?.full_name || agency.contact_email || profile?.email || "Agency";
    const email = profile?.email || agency.contact_email || null;

    return {
        role: "agency",
        label: "Agency",
        name,
        email,
        profileId,
        workerId: null,
        caseHref: "/admin/agencies",
        workspaceHref: profileId ? `/profile/agency?inspect=${profileId}` : null,
    };
}

function buildAdminCandidate(profile: ProfileRow): IdentityCandidate {
    const name = profile.full_name || profile.email || "Admin";
    return {
        role: "admin",
        label: "Admin",
        name,
        email: profile.email || null,
        profileId: profile.id,
        workerId: null,
        caseHref: null,
        workspaceHref: null,
    };
}

function buildLinkedProfileCandidate(profile: ProfileRow): IdentityCandidate {
    const name = profile.full_name || profile.email || "Linked profile";
    return {
        role: "anonymous",
        label: "Linked profile",
        name,
        email: profile.email || null,
        profileId: profile.id,
        workerId: null,
        caseHref: null,
        workspaceHref: null,
    };
}

function candidateScore(candidate: IdentityCandidate): number {
    let score = 0;

    if (candidate.profileId) score += 100;
    if (candidate.workerId) score += 30;
    if (candidate.email) score += 10;

    switch (candidate.role) {
        case "worker":
            score += 40;
            break;
        case "employer":
            score += 30;
            break;
        case "agency":
            score += 20;
            break;
        case "admin":
            score += 10;
            break;
        default:
            score += 0;
    }

    return score;
}

function pickBestCandidate(candidates: IdentityCandidate[] | null | undefined): IdentityCandidate | null {
    if (!candidates || candidates.length === 0) {
        return null;
    }

    return [...candidates].sort((left, right) => candidateScore(right) - candidateScore(left))[0] ?? null;
}

function createPhoneCandidateMap(params: {
    workers: WorkerRow[];
    employers: EmployerRow[];
    agencies: AgencyRow[];
    profilesById: Map<string, ProfileRow>;
    agenciesById: Map<string, AgencyRow>;
}): Map<string, IdentityCandidate[]> {
    const phoneCandidateMap = new Map<string, IdentityCandidate[]>();

    const registerCandidate = (rawPhone: string | null | undefined, candidate: IdentityCandidate | null) => {
        const phone = normalizePhone(rawPhone);
        if (!phone || !candidate) {
            return;
        }

        const current = phoneCandidateMap.get(phone) || [];
        const alreadyPresent = current.some((entry) =>
            entry.role === candidate.role
            && entry.profileId === candidate.profileId
            && entry.workerId === candidate.workerId
        );

        if (!alreadyPresent) {
            current.push(candidate);
            phoneCandidateMap.set(phone, current);
        }
    };

    for (const worker of params.workers) {
        const profile = worker.profile_id ? params.profilesById.get(worker.profile_id) || null : null;
        const agency = worker.agency_id ? params.agenciesById.get(worker.agency_id) || null : null;
        registerCandidate(worker.phone, buildWorkerCandidate(worker, profile, agency));
    }

    for (const employer of params.employers) {
        const profile = employer.profile_id ? params.profilesById.get(employer.profile_id) || null : null;
        registerCandidate(employer.contact_phone, buildEmployerCandidate(employer, profile));
    }

    for (const agency of params.agencies) {
        const profile = agency.profile_id ? params.profilesById.get(agency.profile_id) || null : null;
        registerCandidate(agency.contact_phone, buildAgencyCandidate(agency, profile));
    }

    return phoneCandidateMap;
}

function resolveProfileCandidate(params: {
    profileId: string;
    profilesById: Map<string, ProfileRow>;
    workersByProfileId: Map<string, WorkerRow>;
    employersByProfileId: Map<string, EmployerRow>;
    agenciesByProfileId: Map<string, AgencyRow>;
    agenciesById: Map<string, AgencyRow>;
}): IdentityCandidate | null {
    const profile = params.profilesById.get(params.profileId) || null;
    const normalizedType = normalizeUserType(profile?.user_type);
    const worker = params.workersByProfileId.get(params.profileId) || null;
    const employer = params.employersByProfileId.get(params.profileId) || null;
    const agency = params.agenciesByProfileId.get(params.profileId) || null;

    if (normalizedType === "worker" || worker) {
        const workerAgency = worker?.agency_id ? params.agenciesById.get(worker.agency_id) || null : null;
        return worker ? buildWorkerCandidate(worker, profile, workerAgency) : profile ? buildLinkedProfileCandidate(profile) : null;
    }

    if (normalizedType === "employer" || employer) {
        return employer ? buildEmployerCandidate(employer, profile) : profile ? buildLinkedProfileCandidate(profile) : null;
    }

    if (normalizedType === "agency" || agency) {
        return agency ? buildAgencyCandidate(agency, profile) : profile ? buildLinkedProfileCandidate(profile) : null;
    }

    if (normalizedType === "admin" && profile) {
        return buildAdminCandidate(profile);
    }

    if (profile) {
        return buildLinkedProfileCandidate(profile);
    }

    return null;
}

function buildThreadIdentityContext(params: {
    profiles: ProfileRow[];
    workers: WorkerRow[];
    employers: EmployerRow[];
    agencies: AgencyRow[];
}) {
    const profilesById = new Map(params.profiles.map((profile) => [profile.id, profile] as const));
    const agenciesById = new Map(params.agencies.map((agency) => [agency.id, agency] as const));
    const agenciesByProfileId = new Map(
        params.agencies
            .filter((agency): agency is AgencyRow & { profile_id: string } => typeof agency.profile_id === "string" && agency.profile_id.trim().length > 0)
            .map((agency) => [agency.profile_id, agency] as const)
    );

    const workerGroups = new Map<string, WorkerRow[]>();
    for (const worker of params.workers) {
        if (!worker.profile_id) continue;
        const current = workerGroups.get(worker.profile_id) || [];
        current.push(worker);
        workerGroups.set(worker.profile_id, current);
    }

    const workersByProfileId = new Map(
        Array.from(workerGroups.entries())
            .map(([profileId, rows]) => [profileId, pickCanonicalWorkerRecord(rows)])
            .filter((entry): entry is [string, WorkerRow] => !!entry[1])
    );

    const employerGroups = new Map<string, EmployerRow[]>();
    for (const employer of params.employers) {
        if (!employer.profile_id) continue;
        const current = employerGroups.get(employer.profile_id) || [];
        current.push(employer);
        employerGroups.set(employer.profile_id, current);
    }

    const employersByProfileId = new Map(
        Array.from(employerGroups.entries())
            .map(([profileId, rows]) => [profileId, pickCanonicalEmployerRecord(rows)])
            .filter((entry): entry is [string, EmployerRow] => !!entry[1])
    );

    const phoneCandidateMap = createPhoneCandidateMap({
        workers: params.workers,
        employers: params.employers,
        agencies: params.agencies,
        profilesById,
        agenciesById,
    });

    return {
        profilesById,
        agenciesById,
        agenciesByProfileId,
        workersByProfileId,
        employersByProfileId,
        phoneCandidateMap,
    };
}

export function buildAdminWhatsAppThreadSummariesFromRows(params: {
    rows: AdminWhatsAppThreadSummaryRow[];
    profiles: ProfileRow[];
    workers: WorkerRow[];
    employers: EmployerRow[];
    agencies: AgencyRow[];
}): AdminWhatsAppThreadSummary[] {
    const identityContext = buildThreadIdentityContext(params);

    return params.rows
        .map((row) => {
            const linkedProfileIds = Array.isArray(row.linked_profile_ids)
                ? row.linked_profile_ids.filter((profileId): profileId is string => typeof profileId === "string" && profileId.trim().length > 0)
                : [];
            const primaryLinkedProfileId = linkedProfileIds[0] || null;
            const linkedCandidate = primaryLinkedProfileId
                ? resolveProfileCandidate({
                    profileId: primaryLinkedProfileId,
                    profilesById: identityContext.profilesById,
                    workersByProfileId: identityContext.workersByProfileId,
                    employersByProfileId: identityContext.employersByProfileId,
                    agenciesByProfileId: identityContext.agenciesByProfileId,
                    agenciesById: identityContext.agenciesById,
                })
                : null;
            const phoneCandidate = pickBestCandidate(identityContext.phoneCandidateMap.get(row.phone_number));
            const identity = linkedCandidate || phoneCandidate;
            const identityState: AdminWhatsAppIdentityState = linkedCandidate
                ? "linked"
                : phoneCandidate
                    ? "phone_match"
                    : "unlinked";
            const participantName = identity?.name || row.phone_number;
            const participantRole = identity?.role || "anonymous";
            const participantLabel = identity?.label || "Unlinked phone";
            const participantEmail = identity?.email || null;
            const latestPreview = row.latest_preview || "(no content)";

            return {
                phoneNumber: row.phone_number,
                participantName,
                participantLabel,
                participantRole,
                participantEmail,
                identityState,
                linkedProfileIds,
                hasIdentityDrift: linkedProfileIds.length > 1,
                hasUnlinkedMessages: !!row.has_unlinked_messages,
                latestAt: row.latest_at,
                latestDirection: row.latest_direction || "inbound",
                latestStatus: row.latest_status,
                latestPreview,
                latestTemplateName: row.latest_template_name,
                latestMessageType: row.latest_message_type,
                messageCount: toCount(row.message_count),
                inboundCount: toCount(row.inbound_count),
                outboundCount: toCount(row.outbound_count),
                failedCount: toCount(row.failed_count),
                templateCount: toCount(row.template_count),
                lastSeenAt: null,
                hasUnread: row.latest_direction === "inbound",
                waitingOnUs: row.latest_direction === "inbound",
                caseHref: identity?.caseHref || null,
                workspaceHref: identity?.workspaceHref || null,
                workerId: identity?.workerId || null,
                searchText: [
                    row.phone_number,
                    participantName,
                    participantLabel,
                    participantEmail || "",
                    latestPreview,
                ].join(" ").toLowerCase(),
                messages: [],
            } satisfies AdminWhatsAppThreadSummary;
        })
        .sort((left, right) => {
            const timestampDiff = toTimestamp(right.latestAt) - toTimestamp(left.latestAt);
            if (timestampDiff !== 0) {
                return timestampDiff;
            }

            return left.phoneNumber.localeCompare(right.phoneNumber);
        });
}

export function buildAdminWhatsAppThreads({
    messages,
    profiles,
    workers,
    employers,
    agencies,
}: BuildAdminWhatsAppThreadsParams): AdminWhatsAppThreadSummary[] {
    const identityContext = buildThreadIdentityContext({
        profiles,
        workers,
        employers,
        agencies,
    });

    const sortedMessages = [...messages].sort((left, right) => {
        const timestampDiff = toTimestamp(right.created_at) - toTimestamp(left.created_at);
        if (timestampDiff !== 0) {
            return timestampDiff;
        }

        return right.id.localeCompare(left.id);
    });

    const threadMap = new Map<string, MutableThreadSummary>();

    for (const message of sortedMessages) {
        const phoneNumber = normalizePhone(message.phone_number);
        if (!phoneNumber) {
            continue;
        }

        const existing = threadMap.get(phoneNumber);
        if (!existing) {
            threadMap.set(phoneNumber, {
                phoneNumber,
                latestAt: message.created_at,
                latestDirection: message.direction,
                latestStatus: message.status,
                latestPreview: buildMessagePreview(message),
                latestTemplateName: message.template_name,
                latestMessageType: message.message_type,
                messageCount: 1,
                inboundCount: message.direction === "inbound" ? 1 : 0,
                outboundCount: message.direction === "outbound" ? 1 : 0,
                failedCount: message.status === "failed" ? 1 : 0,
                templateCount: message.template_name || message.message_type === "template" ? 1 : 0,
                linkedProfileIds: new Set(message.user_id ? [message.user_id] : []),
                hasUnlinkedMessages: !message.user_id,
                messages: [message],
            });
            continue;
        }

        existing.messageCount += 1;
        existing.inboundCount += message.direction === "inbound" ? 1 : 0;
        existing.outboundCount += message.direction === "outbound" ? 1 : 0;
        existing.failedCount += message.status === "failed" ? 1 : 0;
        existing.templateCount += message.template_name || message.message_type === "template" ? 1 : 0;
        existing.hasUnlinkedMessages ||= !message.user_id;
        existing.messages.push(message);
        if (message.user_id) {
            existing.linkedProfileIds.add(message.user_id);
        }
    }

    return Array.from(threadMap.values())
        .map((thread) => {
            const linkedProfileIds = Array.from(thread.linkedProfileIds);
            const primaryLinkedProfileId = linkedProfileIds[0] || null;
            const linkedCandidate = primaryLinkedProfileId
                ? resolveProfileCandidate({
                    profileId: primaryLinkedProfileId,
                    profilesById: identityContext.profilesById,
                    workersByProfileId: identityContext.workersByProfileId,
                    employersByProfileId: identityContext.employersByProfileId,
                    agenciesByProfileId: identityContext.agenciesByProfileId,
                    agenciesById: identityContext.agenciesById,
                })
                : null;
            const phoneCandidate = pickBestCandidate(identityContext.phoneCandidateMap.get(thread.phoneNumber));
            const identity = linkedCandidate || phoneCandidate;
            const identityState: AdminWhatsAppIdentityState = linkedCandidate
                ? "linked"
                : phoneCandidate
                    ? "phone_match"
                    : "unlinked";
            const orderedMessages = [...thread.messages]
                .sort((left, right) => {
                    const timestampDiff = toTimestamp(left.created_at) - toTimestamp(right.created_at);
                    if (timestampDiff !== 0) {
                        return timestampDiff;
                    }

                    return left.id.localeCompare(right.id);
                })
                .map((message) => ({
                    id: message.id,
                    direction: message.direction,
                    content: message.content,
                    createdAt: message.created_at,
                    status: message.status,
                    messageType: message.message_type,
                    templateName: message.template_name,
                    errorMessage: message.error_message,
                    preview: buildMessagePreview(message),
                }));

            const participantName = identity?.name || thread.phoneNumber;
            const participantRole = identity?.role || "anonymous";
            const participantLabel = identity?.label || "Unlinked phone";
            const participantEmail = identity?.email || null;
            const searchText = [
                thread.phoneNumber,
                participantName,
                participantLabel,
                participantEmail || "",
                thread.latestPreview,
            ]
                .join(" ")
                .toLowerCase();

            return {
                phoneNumber: thread.phoneNumber,
                participantName,
                participantLabel,
                participantRole,
                participantEmail,
                identityState,
                linkedProfileIds,
                hasIdentityDrift: linkedProfileIds.length > 1,
                hasUnlinkedMessages: thread.hasUnlinkedMessages,
                latestAt: thread.latestAt,
                latestDirection: thread.latestDirection,
                latestStatus: thread.latestStatus,
                latestPreview: thread.latestPreview,
                latestTemplateName: thread.latestTemplateName,
                latestMessageType: thread.latestMessageType,
                messageCount: thread.messageCount,
                inboundCount: thread.inboundCount,
                outboundCount: thread.outboundCount,
                failedCount: thread.failedCount,
                templateCount: thread.templateCount,
                lastSeenAt: null,
                hasUnread: thread.latestDirection === "inbound",
                waitingOnUs: thread.latestDirection === "inbound",
                caseHref: identity?.caseHref || null,
                workspaceHref: identity?.workspaceHref || null,
                workerId: identity?.workerId || null,
                searchText,
                messages: orderedMessages,
            } satisfies AdminWhatsAppThreadSummary;
        })
        .sort((left, right) => {
            const timestampDiff = toTimestamp(right.latestAt) - toTimestamp(left.latestAt);
            if (timestampDiff !== 0) {
                return timestampDiff;
            }

            return left.phoneNumber.localeCompare(right.phoneNumber);
        });
}

async function fetchAllWhatsAppMessages(admin: AdminDbClient): Promise<WhatsAppMessageRow[]> {
    const rows: WhatsAppMessageRow[] = [];
    let from = 0;

    while (true) {
        const to = from + FETCH_PAGE_SIZE - 1;
        const { data, error } = await admin
            .from("whatsapp_messages")
            .select("id, user_id, phone_number, direction, content, created_at, status, message_type, template_name, error_message, wamid")
            .order("created_at", { ascending: false })
            .range(from, to);

        if (error) {
            throw error;
        }

        const batch = Array.isArray(data) ? (data as WhatsAppMessageRow[]) : [];
        if (batch.length === 0) {
            break;
        }

        rows.push(...batch);

        if (batch.length < FETCH_PAGE_SIZE) {
            break;
        }

        from += FETCH_PAGE_SIZE;
    }

    return rows;
}

async function fetchAdminWhatsAppThreadSummaryRows(admin: AdminDbClient): Promise<AdminWhatsAppThreadSummaryRow[] | null> {
    const { data, error } = await adminWhatsAppTable<AdminWhatsAppThreadSummaryRow[]>(admin, "admin_whatsapp_thread_summaries")
        .select("phone_number, latest_at, latest_direction, latest_status, latest_preview, latest_template_name, latest_message_type, message_count, inbound_count, outbound_count, failed_count, template_count, has_unlinked_messages, linked_profile_ids")
        .order("latest_at", { ascending: false });

    if (error) {
        if (isMissingAdminWhatsAppViewError(error)) {
            return null;
        }

        throw error;
    }

    return Array.isArray(data) ? data : [];
}

async function fetchAdminWhatsAppThreadViews(
    admin: AdminDbClient,
    adminProfileId: string | null | undefined
): Promise<AdminWhatsAppThreadViewRow[]> {
    if (!adminProfileId) {
        return [];
    }

    const { data, error } = await adminWhatsAppTable<AdminWhatsAppThreadViewRow[]>(admin, "admin_whatsapp_thread_views")
        .select("phone_number, last_seen_at")
        .eq("admin_profile_id", adminProfileId);

    if (error) {
        if (isMissingAdminWhatsAppViewError(error)) {
            return [];
        }

        throw error;
    }

    return Array.isArray(data) ? data : [];
}

function mapAdminWhatsAppMessageLogRows(rows: AdminWhatsAppMessageLogRow[]): AdminWhatsAppMessageView[] {
    return [...rows]
        .sort((left, right) => {
            const timestampDiff = toTimestamp(left.created_at) - toTimestamp(right.created_at);
            if (timestampDiff !== 0) {
                return timestampDiff;
            }

            return left.id.localeCompare(right.id);
        })
        .map((row) => ({
            id: row.id,
            direction: row.direction,
            content: row.content,
            createdAt: row.created_at,
            status: row.status,
            messageType: row.message_type,
            templateName: row.template_name,
            errorMessage: row.error_message,
            preview: row.preview || buildMessagePreview(row),
        }));
}

export async function loadAdminWhatsAppThreadMessages(admin: AdminDbClient, phoneNumber: string): Promise<AdminWhatsAppMessageView[]> {
    const normalizedPhone = normalizePhone(phoneNumber);
    if (!normalizedPhone) {
        return [];
    }

    const { data, error } = await adminWhatsAppTable<AdminWhatsAppMessageLogRow[]>(admin, "admin_whatsapp_message_log")
        .select("id, normalized_phone_number, direction, content, created_at, status, message_type, template_name, error_message, preview")
        .eq("normalized_phone_number", normalizedPhone)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true });

    if (!error) {
        return mapAdminWhatsAppMessageLogRows(Array.isArray(data) ? data : []);
    }

    if (!isMissingAdminWhatsAppViewError(error)) {
        throw error;
    }

    const fallbackMessages = (await fetchAllWhatsAppMessages(admin))
        .filter((message) => normalizePhone(message.phone_number) === normalizedPhone)
        .sort((left, right) => {
            const timestampDiff = toTimestamp(left.created_at) - toTimestamp(right.created_at);
            if (timestampDiff !== 0) {
                return timestampDiff;
            }

            return left.id.localeCompare(right.id);
        })
        .map((message) => ({
            id: message.id,
            direction: message.direction,
            content: message.content,
            createdAt: message.created_at,
            status: message.status,
            messageType: message.message_type,
            templateName: message.template_name,
            errorMessage: message.error_message,
            preview: buildMessagePreview(message),
        }));

    return fallbackMessages;
}

export async function loadAdminWhatsAppOverview(
    admin: AdminDbClient,
    options?: {
        adminProfileId?: string | null;
    }
): Promise<AdminWhatsAppOverview> {
    const [
        summaryRows,
        threadViews,
        totalMessageCountResult,
        { data: profilesRaw, error: profilesError },
        { data: workersRaw, error: workersError },
        { data: employersRaw, error: employersError },
        { data: agenciesRaw, error: agenciesError },
    ] = await Promise.all([
        fetchAdminWhatsAppThreadSummaryRows(admin),
        fetchAdminWhatsAppThreadViews(admin, options?.adminProfileId),
        admin.from("whatsapp_messages").select("id", { count: "exact", head: true }),
        admin.from("profiles").select("id, full_name, email, user_type"),
        admin.from("worker_onboarding").select("id, profile_id, agency_id, submitted_email, submitted_full_name, phone, status, updated_at, entry_fee_paid, job_search_active, admin_approved, queue_joined_at"),
        admin.from("employers").select("id, profile_id, company_name, contact_email, contact_phone, status, updated_at, created_at, admin_approved"),
        admin.from("agencies").select("id, profile_id, display_name, legal_name, contact_email, contact_phone"),
    ]);

    if (totalMessageCountResult.error) throw totalMessageCountResult.error;
    if (profilesError) throw profilesError;
    if (workersError) throw workersError;
    if (employersError) throw employersError;
    if (agenciesError) throw agenciesError;

    const profiles = Array.isArray(profilesRaw) ? (profilesRaw as ProfileRow[]) : [];
    const workers = Array.isArray(workersRaw) ? (workersRaw as WorkerRow[]) : [];
    const employers = Array.isArray(employersRaw) ? (employersRaw as EmployerRow[]) : [];
    const agencies = Array.isArray(agenciesRaw) ? (agenciesRaw as AgencyRow[]) : [];
    const totalMessages = totalMessageCountResult.count || 0;

    if (summaryRows) {
        const threads = mergeAdminWhatsAppThreadViewState(buildAdminWhatsAppThreadSummariesFromRows({
            rows: summaryRows,
            profiles,
            workers,
            employers,
            agencies,
        }), threadViews);

        return {
            threads,
            totalMessages,
        };
    }

    const messages = await fetchAllWhatsAppMessages(admin);
    const threads = mergeAdminWhatsAppThreadViewState(buildAdminWhatsAppThreads({
        messages,
        profiles,
        workers,
        employers,
        agencies,
    }), threadViews);

    return {
        threads,
        totalMessages: totalMessages || messages.length,
    };
}
