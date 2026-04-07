import { describe, expect, it } from "vitest";
import {
    buildAdminWhatsAppThreads,
    buildAdminWhatsAppThreadSummariesFromRows,
    isAdminWhatsAppIdentityRiskThread,
    isAdminWhatsAppOpsTriageThread,
    isAdminWhatsAppRecentThread,
    isAdminWhatsAppUnreadThread,
    isAdminWhatsAppWaitingOnUsThread,
    mergeAdminWhatsAppThreadViewState,
} from "@/lib/admin-whatsapp";

describe("admin-whatsapp", () => {
    it("groups messages into worker threads and keeps transcript order ascending", () => {
        const threads = buildAdminWhatsAppThreads({
            messages: [
                {
                    id: "msg-2",
                    user_id: "profile-worker",
                    phone_number: "+381600000001",
                    direction: "outbound",
                    content: "Your dashboard is ready.",
                    created_at: "2026-04-04T11:00:00.000Z",
                    status: "delivered",
                    message_type: "text",
                    template_name: null,
                    error_message: null,
                    wamid: "wamid-2",
                },
                {
                    id: "msg-1",
                    user_id: "profile-worker",
                    phone_number: "+381600000001",
                    direction: "inbound",
                    content: "Hello, I need help.",
                    created_at: "2026-04-04T10:00:00.000Z",
                    status: "delivered",
                    message_type: "text",
                    template_name: null,
                    error_message: null,
                    wamid: "wamid-1",
                },
            ],
            profiles: [
                {
                    id: "profile-worker",
                    full_name: "Amina Worker",
                    email: "amina@example.com",
                    user_type: "worker",
                },
            ],
            workers: [
                {
                    id: "worker-1",
                    profile_id: "profile-worker",
                    submitted_full_name: "Amina Worker",
                    submitted_email: "amina@example.com",
                    phone: "+381600000001",
                    status: "PROFILE_COMPLETE",
                },
            ],
            employers: [],
            agencies: [],
        });

        expect(threads).toHaveLength(1);
        expect(threads[0]).toMatchObject({
            phoneNumber: "+381600000001",
            participantName: "Amina Worker",
            participantRole: "worker",
            identityState: "linked",
            caseHref: "/admin/workers/worker-1",
            workspaceHref: "/profile/worker?inspect=profile-worker",
            messageCount: 2,
            inboundCount: 1,
            outboundCount: 1,
        });
        expect(threads[0].messages.map((message) => message.id)).toEqual(["msg-1", "msg-2"]);
        expect(threads[0].latestPreview).toBe("Your dashboard is ready.");
    });

    it("falls back to phone ownership when whatsapp rows are still unlinked", () => {
        const threads = buildAdminWhatsAppThreads({
            messages: [
                {
                    id: "msg-3",
                    user_id: null,
                    phone_number: "+381600000002",
                    direction: "outbound",
                    content: null,
                    created_at: "2026-04-04T12:00:00.000Z",
                    status: "failed",
                    message_type: "template",
                    template_name: "profile_incomplete",
                    error_message: "recipient blocked",
                    wamid: "wamid-3",
                },
                {
                    id: "msg-4",
                    user_id: null,
                    phone_number: "+381600000002",
                    direction: "inbound",
                    content: "I already sent the documents.",
                    created_at: "2026-04-04T12:05:00.000Z",
                    status: "delivered",
                    message_type: "text",
                    template_name: null,
                    error_message: null,
                    wamid: "wamid-4",
                },
            ],
            profiles: [
                {
                    id: "profile-employer",
                    full_name: "Northwind Foods",
                    email: "ops@northwind.example",
                    user_type: "employer",
                },
            ],
            workers: [],
            employers: [
                {
                    id: "employer-1",
                    profile_id: "profile-employer",
                    company_name: "Northwind Foods",
                    contact_email: "ops@northwind.example",
                    contact_phone: "+381600000002",
                    status: "PENDING",
                },
            ],
            agencies: [],
        });

        expect(threads).toHaveLength(1);
        expect(threads[0]).toMatchObject({
            participantName: "Northwind Foods",
            participantRole: "employer",
            identityState: "phone_match",
            caseHref: "/admin/employers",
            workspaceHref: "/profile/employer?inspect=profile-employer",
            failedCount: 1,
            hasUnlinkedMessages: true,
            latestPreview: "I already sent the documents.",
        });
        expect(threads[0].messages[0].preview).toBe("Template: profile_incomplete");
        expect(threads[0].messages[0].errorMessage).toBe("recipient blocked");
    });

    it("builds summary threads from SQL aggregate rows without preloading full transcripts", () => {
        const threads = buildAdminWhatsAppThreadSummariesFromRows({
            rows: [
                {
                    phone_number: "+381600000003",
                    latest_at: "2026-04-04T13:00:00.000Z",
                    latest_direction: "outbound",
                    latest_status: "delivered",
                    latest_preview: "We received your documents.",
                    latest_template_name: null,
                    latest_message_type: "text",
                    message_count: 4,
                    inbound_count: 2,
                    outbound_count: 2,
                    failed_count: 0,
                    template_count: 1,
                    has_unlinked_messages: true,
                    linked_profile_ids: ["profile-worker-2"],
                },
            ],
            profiles: [
                {
                    id: "profile-worker-2",
                    full_name: "Ravi Kumar",
                    email: "ravi@example.com",
                    user_type: "worker",
                },
            ],
            workers: [
                {
                    id: "worker-2",
                    profile_id: "profile-worker-2",
                    submitted_full_name: "Ravi Kumar",
                    submitted_email: "ravi@example.com",
                    phone: "+381600000003",
                    status: "IN_QUEUE",
                },
            ],
            employers: [],
            agencies: [],
        });

        expect(threads).toHaveLength(1);
        expect(threads[0]).toMatchObject({
            phoneNumber: "+381600000003",
            participantName: "Ravi Kumar",
            participantRole: "worker",
            identityState: "linked",
            messageCount: 4,
            inboundCount: 2,
            outboundCount: 2,
            templateCount: 1,
            hasUnlinkedMessages: true,
            latestPreview: "We received your documents.",
            caseHref: "/admin/workers/worker-2",
        });
        expect(threads[0].messages).toEqual([]);
    });

    it("classifies identity-risk, ops-triage, and recent threads consistently", () => {
        const safeThread = buildAdminWhatsAppThreadSummariesFromRows({
            rows: [
                {
                    phone_number: "+381600000004",
                    latest_at: "2026-04-04T09:00:00.000Z",
                    latest_direction: "inbound",
                    latest_status: "delivered",
                    latest_preview: "Hello there",
                    latest_template_name: null,
                    latest_message_type: "text",
                    message_count: 1,
                    inbound_count: 1,
                    outbound_count: 0,
                    failed_count: 0,
                    template_count: 0,
                    has_unlinked_messages: false,
                    linked_profile_ids: ["profile-worker-4"],
                },
            ],
            profiles: [
                {
                    id: "profile-worker-4",
                    full_name: "Safe Worker",
                    email: "safe@example.com",
                    user_type: "worker",
                },
            ],
            workers: [
                {
                    id: "worker-4",
                    profile_id: "profile-worker-4",
                    submitted_full_name: "Safe Worker",
                    submitted_email: "safe@example.com",
                    phone: "+381600000004",
                    status: "IN_QUEUE",
                },
            ],
            employers: [],
            agencies: [],
        })[0];

        const riskyThread = buildAdminWhatsAppThreadSummariesFromRows({
            rows: [
                {
                    phone_number: "+381600000005",
                    latest_at: "2026-04-02T09:00:00.000Z",
                    latest_direction: "outbound",
                    latest_status: "failed",
                    latest_preview: "Template: profile_incomplete",
                    latest_template_name: "profile_incomplete",
                    latest_message_type: "template",
                    message_count: 3,
                    inbound_count: 1,
                    outbound_count: 2,
                    failed_count: 1,
                    template_count: 1,
                    has_unlinked_messages: true,
                    linked_profile_ids: [],
                },
            ],
            profiles: [],
            workers: [],
            employers: [],
            agencies: [],
        })[0];

        expect(isAdminWhatsAppIdentityRiskThread(safeThread)).toBe(false);
        expect(isAdminWhatsAppOpsTriageThread(safeThread)).toBe(false);
        expect(isAdminWhatsAppRecentThread(safeThread, new Date("2026-04-04T12:00:00.000Z"), 7)).toBe(true);

        expect(isAdminWhatsAppIdentityRiskThread(riskyThread)).toBe(true);
        expect(isAdminWhatsAppOpsTriageThread(riskyThread)).toBe(true);
        expect(isAdminWhatsAppRecentThread(riskyThread, new Date("2026-04-20T12:00:00.000Z"), 7)).toBe(false);
    });

    it("derives unread and seen state from admin thread-view rows", () => {
        const threads = buildAdminWhatsAppThreadSummariesFromRows({
            rows: [
                {
                    phone_number: "+381600000006",
                    latest_at: "2026-04-04T14:00:00.000Z",
                    latest_direction: "inbound",
                    latest_status: "delivered",
                    latest_preview: "Can you check my case?",
                    latest_template_name: null,
                    latest_message_type: "text",
                    message_count: 2,
                    inbound_count: 2,
                    outbound_count: 0,
                    failed_count: 0,
                    template_count: 0,
                    has_unlinked_messages: false,
                    linked_profile_ids: [],
                },
                {
                    phone_number: "+381600000007",
                    latest_at: "2026-04-04T14:30:00.000Z",
                    latest_direction: "outbound",
                    latest_status: "delivered",
                    latest_preview: "We replied from support.",
                    latest_template_name: null,
                    latest_message_type: "text",
                    message_count: 3,
                    inbound_count: 1,
                    outbound_count: 2,
                    failed_count: 0,
                    template_count: 0,
                    has_unlinked_messages: false,
                    linked_profile_ids: [],
                },
            ],
            profiles: [],
            workers: [],
            employers: [],
            agencies: [],
        });
        const inboundThread = threads.find((thread) => thread.phoneNumber === "+381600000006");
        const outboundThread = threads.find((thread) => thread.phoneNumber === "+381600000007");

        expect(inboundThread).toBeTruthy();
        expect(outboundThread).toBeTruthy();
        expect(isAdminWhatsAppUnreadThread(inboundThread!)).toBe(true);
        expect(isAdminWhatsAppWaitingOnUsThread(inboundThread!)).toBe(true);
        expect(isAdminWhatsAppUnreadThread(outboundThread!)).toBe(false);
        expect(isAdminWhatsAppWaitingOnUsThread(outboundThread!)).toBe(false);

        const [seenThread] = mergeAdminWhatsAppThreadViewState([inboundThread!], [
            {
                phone_number: "+381600000006",
                last_seen_at: "2026-04-04T14:00:00.000Z",
            },
        ]);

        expect(seenThread.hasUnread).toBe(false);
        expect(seenThread.waitingOnUs).toBe(true);
        expect(seenThread.lastSeenAt).toBe("2026-04-04T14:00:00.000Z");
    });
});
