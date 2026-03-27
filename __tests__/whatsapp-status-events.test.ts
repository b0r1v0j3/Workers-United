import { describe, expect, it } from "vitest";
import {
    buildWhatsAppStatusUpdateData,
    persistWhatsAppDeliveryStatuses,
} from "@/lib/whatsapp-status-events";

function createStatusAdminClient() {
    const updates: Array<{ payload: Record<string, string>; column: string; value: string }> = [];
    let nextError: { message?: string | null } | null = null;
    let nextEmpty = false;

    return {
        updates,
        setNextError(errorMessage: string) {
            nextError = { message: errorMessage };
        },
        setNextEmpty() {
            nextEmpty = true;
        },
        client: {
            from(table: string) {
                expect(table).toBe("whatsapp_messages");

                return {
                    update(payload: Record<string, string>) {
                        return {
                            eq(column: string, value: string) {
                                return {
                                    select: async () => {
                                        updates.push({ payload, column, value });
                                        if (nextError) {
                                            const error = nextError;
                                            nextError = null;
                                            return { data: null, error };
                                        }
                                        if (nextEmpty) {
                                            nextEmpty = false;
                                            return { data: [], error: null };
                                        }
                                        return { data: [{ id: value }], error: null };
                                    },
                                };
                            },
                        };
                    },
                };
            },
        },
    };
}

describe("whatsapp-status-events", () => {
    it("builds failure payloads with provider error details", () => {
        expect(buildWhatsAppStatusUpdateData({
            id: "wamid_1",
            status: "failed",
            errors: [{ code: 131026, title: "Recipient blocked the message" }],
        })).toEqual({
            status: "failed",
            error_message: "131026: Recipient blocked the message",
        });
    });

    it("returns null for malformed status events", () => {
        expect(buildWhatsAppStatusUpdateData({ id: "", status: "delivered" })).toBeNull();
        expect(buildWhatsAppStatusUpdateData({ id: "wamid_2", status: "" })).toBeNull();
    });

    it("persists only valid delivery status updates", async () => {
        const { client, updates } = createStatusAdminClient();

        const persistedCount = await persistWhatsAppDeliveryStatuses(client, [
            { id: "wamid_1", status: "sent" },
            { id: " ", status: "failed", errors: [{ code: 1, title: "Ignored" }] },
            { id: "wamid_2", status: "failed", errors: [{ code: 131026, title: "Recipient blocked the message" }] },
        ]);

        expect(persistedCount).toBe(2);
        expect(updates).toEqual([
            {
                payload: { status: "sent" },
                column: "wamid",
                value: "wamid_1",
            },
            {
                payload: {
                    status: "failed",
                    error_message: "131026: Recipient blocked the message",
                },
                column: "wamid",
                value: "wamid_2",
            },
        ]);
    });

    it("throws when the whatsapp_messages update fails", async () => {
        const { client, setNextError } = createStatusAdminClient();
        setNextError("db exploded");

        await expect(
            persistWhatsAppDeliveryStatuses(client, [{ id: "wamid_3", status: "delivered" }])
        ).rejects.toThrow("db exploded");
    });

    it("silently skips when no whatsapp_messages row matches the wamid", async () => {
        const { client, setNextEmpty } = createStatusAdminClient();
        setNextEmpty();

        const count = await persistWhatsAppDeliveryStatuses(client, [{ id: "wamid_missing", status: "sent" }]);
        expect(count).toBe(0);
    });
});
