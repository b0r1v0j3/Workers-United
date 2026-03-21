import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authGetUser = vi.fn();
const selectEqUser = vi.fn();
const selectEqStatus = vi.fn();
const selectOrder = vi.fn();
const selectLimit = vi.fn();
const updateEqRoot = vi.fn();
const updateEqStatusForUser = vi.fn();
const updateIsRead = vi.fn();
const updateEqUserAfterId = vi.fn();
const updateEqStatusAfterId = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
    createClient: async () => ({
        auth: {
            getUser: authGetUser,
        },
        from: (table: string) => {
            if (table !== "email_queue") {
                throw new Error(`Unexpected table ${table}`);
            }

            return {
                select: () => ({
                    eq: selectEqUser,
                }),
                update: () => ({
                    eq: updateEqRoot,
                }),
            };
        },
    }),
}));

describe("/api/notifications", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        authGetUser.mockResolvedValue({
            data: {
                user: {
                    id: "worker-1",
                },
            },
        });

        selectEqUser.mockImplementation(() => ({
            eq: selectEqStatus,
        }));
        selectEqStatus.mockImplementation(() => ({
            order: selectOrder,
        }));
        selectOrder.mockImplementation(() => ({
            limit: selectLimit,
        }));
        selectLimit.mockResolvedValue({
            data: [
                {
                    id: "email-1",
                    email_type: "payment_success",
                    status: "sent",
                    created_at: "2026-03-21T10:00:00.000Z",
                    read_at: null,
                },
            ],
            error: null,
        });

        updateEqRoot.mockImplementation((column: string) => {
            if (column === "user_id") {
                return {
                    eq: updateEqStatusForUser,
                };
            }

            if (column === "id") {
                return {
                    eq: updateEqUserAfterId,
                };
            }

            throw new Error(`Unexpected update eq root column ${column}`);
        });

        updateEqStatusForUser.mockImplementation(() => ({
            is: updateIsRead,
        }));
        updateIsRead.mockResolvedValue({ error: null });

        updateEqUserAfterId.mockImplementation(() => ({
            eq: updateEqStatusAfterId,
        }));
        updateEqStatusAfterId.mockResolvedValue({ error: null });
    });

    it("loads only sent email_queue rows as notifications", async () => {
        const { GET } = await import("@/app/api/notifications/route");

        const response = await GET();
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(selectEqUser).toHaveBeenCalledWith("user_id", "worker-1");
        expect(selectEqStatus).toHaveBeenCalledWith("status", "sent");
        expect(payload).toEqual({
            notifications: [
                {
                    id: "email-1",
                    type: "payment_success",
                    title: "Payment received — thank you!",
                    icon: "💳",
                    time: "2026-03-21T10:00:00.000Z",
                    read: false,
                },
            ],
            unreadCount: 1,
        });
    });

    it("marks only sent notifications as read when markAll is used", async () => {
        const { PATCH } = await import("@/app/api/notifications/route");

        const response = await PATCH(new NextRequest("http://localhost/api/notifications", {
            method: "PATCH",
            body: JSON.stringify({ markAll: true }),
        }));

        expect(response.status).toBe(200);
        expect(updateEqRoot).toHaveBeenCalledWith("user_id", "worker-1");
        expect(updateEqStatusForUser).toHaveBeenCalledWith("status", "sent");
        expect(updateIsRead).toHaveBeenCalledWith("read_at", null);
    });

    it("marks a single notification as read only when it is sent", async () => {
        const { PATCH } = await import("@/app/api/notifications/route");

        const response = await PATCH(new NextRequest("http://localhost/api/notifications", {
            method: "PATCH",
            body: JSON.stringify({ id: "email-1" }),
        }));

        expect(response.status).toBe(200);
        expect(updateEqRoot).toHaveBeenCalledWith("id", "email-1");
        expect(updateEqUserAfterId).toHaveBeenCalledWith("user_id", "worker-1");
        expect(updateEqStatusAfterId).toHaveBeenCalledWith("status", "sent");
    });
});
