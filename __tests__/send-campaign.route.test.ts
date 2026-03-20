import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const createClient = vi.fn();
const createAdminClient = vi.fn();
const queueEmail = vi.fn();
const isGodModeUser = vi.fn(() => false);

function assertResponse(response: NextResponse | undefined): asserts response is NextResponse {
    if (!response) {
        throw new Error("Expected a response");
    }
}

function buildAuthQuery(userType: string | null) {
    const query: Record<string, unknown> = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        single: vi.fn(async () => ({
            data: { user_type: userType },
            error: null,
        })),
    };

    return query;
}

function buildOutreachQuery(recipients: Array<Record<string, unknown>>) {
    const query: Record<string, unknown> = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        update: vi.fn(() => ({
            eq: vi.fn(async () => ({ error: null })),
        })),
        then: (resolve: (value: { data: Array<Record<string, unknown>>; error: null }) => void) => {
            resolve({ data: recipients, error: null });
        },
    };

    return query;
}

vi.mock("@/lib/supabase/server", () => ({
    createClient,
}));

vi.mock("@/lib/supabase/admin", () => ({
    createAdminClient,
}));

vi.mock("@/lib/email-templates", () => ({
    queueEmail,
}));

vi.mock("@/lib/godmode", () => ({
    isGodModeUser,
}));

describe("POST /api/admin/send-campaign", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();

        createClient.mockResolvedValue({
            auth: {
                getUser: vi.fn(async () => ({
                    data: { user: null },
                    error: null,
                })),
            },
            from: vi.fn(() => buildAuthQuery("worker")),
        });

        createAdminClient.mockReturnValue({
            from: vi.fn(() => buildOutreachQuery([])),
        });

        queueEmail.mockResolvedValue({
            id: "email-1",
            sent: true,
            error: null,
        });
    });

    it("rejects anonymous requests before touching the bulk send path", async () => {
        const { POST } = await import("@/app/api/admin/send-campaign/route");

        const request = new NextRequest("http://localhost/api/admin/send-campaign", {
            method: "POST",
            body: JSON.stringify({
                campaign: "spring-2026",
                subject: "Hello",
            }),
        });

        const response = await POST(request);
        assertResponse(response);

        expect(response.status).toBe(401);
        expect(queueEmail).not.toHaveBeenCalled();
    });

    it("rejects non-admin users with a forbidden response", async () => {
        createClient.mockResolvedValueOnce({
            auth: {
                getUser: vi.fn(async () => ({
                    data: {
                        user: {
                            id: "user-1",
                            email: "worker@example.com",
                            user_metadata: { user_type: "worker" },
                        },
                    },
                    error: null,
                })),
            },
            from: vi.fn(() => buildAuthQuery("worker")),
        });

        const { POST } = await import("@/app/api/admin/send-campaign/route");

        const request = new NextRequest("http://localhost/api/admin/send-campaign", {
            method: "POST",
            body: JSON.stringify({
                campaign: "spring-2026",
                subject: "Hello",
            }),
        });

        const response = await POST(request);
        assertResponse(response);

        expect(response.status).toBe(403);
        expect(queueEmail).not.toHaveBeenCalled();
        expect(createAdminClient).not.toHaveBeenCalled();
    });

    it("keeps dry_run behavior and does not dispatch emails", async () => {
        createClient.mockResolvedValueOnce({
            auth: {
                getUser: vi.fn(async () => ({
                    data: {
                        user: {
                            id: "admin-1",
                            email: "admin@example.com",
                            user_metadata: { user_type: "admin" },
                        },
                    },
                    error: null,
                })),
            },
            from: vi.fn(() => buildAuthQuery("admin")),
        });

        createAdminClient.mockReturnValueOnce({
            from: vi.fn(() => buildOutreachQuery([
                {
                    id: "campaign-row-1",
                    company_name: "Acme Ltd",
                    email: "sales@acme.com",
                    status: "delivered",
                },
                {
                    id: "campaign-row-2",
                    company_name: "Beta LLC",
                    email: "team@beta.com",
                    status: "delivered",
                },
            ])),
        });

        const { POST } = await import("@/app/api/admin/send-campaign/route");

        const request = new NextRequest("http://localhost/api/admin/send-campaign", {
            method: "POST",
            body: JSON.stringify({
                campaign: "spring-2026",
                subject: "Hello employers",
                dry_run: true,
            }),
        });

        const response = await POST(request);
        assertResponse(response);
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload).toEqual({
            dry_run: true,
            count: 2,
            sample: [
                { company: "Acme Ltd", email: "sales@acme.com" },
                { company: "Beta LLC", email: "team@beta.com" },
            ],
        });
        expect(queueEmail).not.toHaveBeenCalled();
    });

    it("queues each recipient through queueEmail and updates campaign status", async () => {
        createClient.mockResolvedValueOnce({
            auth: {
                getUser: vi.fn(async () => ({
                    data: {
                        user: {
                            id: "admin-1",
                            email: "admin@example.com",
                            user_metadata: { user_type: "admin" },
                        },
                    },
                    error: null,
                })),
            },
            from: vi.fn(() => buildAuthQuery("admin")),
        });

        const update = vi.fn(() => ({
            eq: vi.fn(async () => ({ error: null })),
        }));

        createAdminClient.mockReturnValueOnce({
            from: vi.fn((table: string) => {
                if (table === "outreach_campaigns") {
                    return {
                        select: vi.fn(() => ({
                            eq: vi.fn(() => ({
                                eq: vi.fn(async () => ({
                                    data: [
                                        {
                                            id: "campaign-row-1",
                                            company_name: "Acme Ltd",
                                            email: "sales@acme.com",
                                            status: "delivered",
                                        },
                                        {
                                            id: "campaign-row-2",
                                            company_name: "Beta LLC",
                                            email: "team@beta.com",
                                            status: "delivered",
                                        },
                                    ],
                                    error: null,
                                })),
                            })),
                        })),
                        update,
                    };
                }

                throw new Error(`Unexpected table: ${table}`);
            }),
        });

        const { POST } = await import("@/app/api/admin/send-campaign/route");

        const request = new NextRequest("http://localhost/api/admin/send-campaign", {
            method: "POST",
            body: JSON.stringify({
                campaign: "spring-2026",
                subject: "Hello employers",
            }),
        });

        const response = await POST(request);
        assertResponse(response);
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload).toEqual({
            sent: 2,
            failed: 0,
            errors: [],
        });
        expect(queueEmail).toHaveBeenCalledTimes(2);
        expect(queueEmail).toHaveBeenNthCalledWith(
            1,
            expect.anything(),
            null,
            "employer_outreach",
            "sales@acme.com",
            "Acme Ltd",
            expect.objectContaining({
                subject: "Hello employers",
                campaignLanguage: "sr",
                recipientRole: "employer",
            }),
        );
        expect(queueEmail).toHaveBeenNthCalledWith(
            2,
            expect.anything(),
            null,
            "employer_outreach",
            "team@beta.com",
            "Beta LLC",
            expect.objectContaining({
                subject: "Hello employers",
                campaignLanguage: "sr",
                recipientRole: "employer",
            }),
        );
        expect(update).toHaveBeenCalledTimes(2);
    });
});
