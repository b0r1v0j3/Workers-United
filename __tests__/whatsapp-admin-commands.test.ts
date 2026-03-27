import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    saveBrainFactsDedup,
    sendWhatsAppText,
} = vi.hoisted(() => ({
    saveBrainFactsDedup: vi.fn(),
    sendWhatsAppText: vi.fn(),
}));

vi.mock("@/lib/brain-memory", () => ({
    saveBrainFactsDedup,
}));

vi.mock("@/lib/whatsapp", () => ({
    sendWhatsAppText,
}));

import { handleWhatsAppAdminCommand } from "@/lib/whatsapp-admin-commands";

function createAdminClient(overrides?: {
    selectData?: Record<string, unknown[]>;
}) {
    return {
        from(table: string) {
            if (table !== "brain_memory") {
                throw new Error(`Unexpected table: ${table}`);
            }

            return {
                select() {
                    return {
                        ilike() {
                            return {
                                limit: async () => ({
                                    data: overrides?.selectData?.ilikeLimit ?? [],
                                }),
                            };
                        },
                        order() {
                            return {
                                data: overrides?.selectData?.ordered ?? [],
                            };
                        },
                    };
                },
                update(payload: Record<string, unknown>) {
                    return {
                        eq: async (column: string, value: string) => ({
                            data: [{ column, value, payload }],
                        }),
                    };
                },
                delete() {
                    return {
                        eq: async (column: string, value: string) => ({
                            data: [{ column, value }],
                        }),
                    };
                },
            };
        },
    };
}

describe("whatsapp-admin-commands", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sendWhatsAppText.mockResolvedValue({ success: true, messageId: "wamid_admin" });
    });

    it("returns unhandled result for non-admin commands", async () => {
        const result = await handleWhatsAppAdminCommand({
            admin: createAdminClient() as never,
            normalizedPhone: "+381600000000",
            content: "hello there",
            profileId: "profile_1",
        });

        expect(result).toEqual({ handled: false, replySent: false });
        expect(sendWhatsAppText).not.toHaveBeenCalled();
    });

    it("adds a new fact for zapamti commands", async () => {
        const result = await handleWhatsAppAdminCommand({
            admin: createAdminClient() as never,
            normalizedPhone: "+381600000000",
            content: "zapamti: copy_rule | Keep replies short",
            profileId: "profile_1",
        });

        expect(result).toEqual({ handled: true, replySent: true });
        expect(saveBrainFactsDedup).toHaveBeenCalledWith(
            expect.anything(),
            [{ category: "copy_rule", content: "Keep replies short", confidence: 1.0 }]
        );
        expect(sendWhatsAppText).toHaveBeenCalledWith(
            "+381600000000",
            "🧠 Zapamćeno!\n[copy_rule] Keep replies short\nConfidence: 1.0",
            "profile_1"
        );
    });

    it("updates an existing fact for ispravi commands", async () => {
        const result = await handleWhatsAppAdminCommand({
            admin: createAdminClient({
                selectData: {
                    ilikeLimit: [{ id: "brain_1", content: "Old fact" }],
                },
            }) as never,
            normalizedPhone: "+381600000000",
            content: "ispravi: Old fact -> New fact",
            profileId: "profile_1",
        });

        expect(result).toEqual({ handled: true, replySent: true });
        expect(saveBrainFactsDedup).not.toHaveBeenCalled();
        expect(sendWhatsAppText).toHaveBeenCalledWith(
            "+381600000000",
            "✅ Ispravljeno!\n\nStaro: Old fact\nNovo: New fact\n\nConfidence: 1.0 (admin verified)",
            "profile_1"
        );
    });

    it("deletes a matching fact for obrisi commands", async () => {
        const result = await handleWhatsAppAdminCommand({
            admin: createAdminClient({
                selectData: {
                    ilikeLimit: [{ id: "brain_2", content: "Bad fact", category: "faq" }],
                },
            }) as never,
            normalizedPhone: "+381600000000",
            content: "obrisi: Bad fact",
            profileId: null,
        });

        expect(result).toEqual({ handled: true, replySent: true });
        expect(sendWhatsAppText).toHaveBeenCalledWith(
            "+381600000000",
            "🗑️ Obrisano:\n[faq] Bad fact",
            undefined
        );
    });

    it("lists memory entries for memorija command", async () => {
        const result = await handleWhatsAppAdminCommand({
            admin: createAdminClient({
                selectData: {
                    ordered: [
                        { category: "copy_rule", content: "Reply clearly", confidence: 0.9 },
                        { category: "faq", content: "Use dashboard links", confidence: 0.8 },
                    ],
                },
            }) as never,
            normalizedPhone: "+381600000000",
            content: "memorija",
            profileId: "profile_1",
        });

        expect(result).toEqual({ handled: true, replySent: true });
        expect(sendWhatsAppText).toHaveBeenCalledWith(
            "+381600000000",
            "🧠 Brain Memory (2 facts):\n\n1. [copy_rule] Reply clearly (0.9)\n2. [faq] Use dashboard links (0.8)",
            "profile_1"
        );
    });

    it("surfaces reply delivery failure in the result", async () => {
        sendWhatsAppText.mockResolvedValueOnce({ success: false, error: "meta failed" });

        const result = await handleWhatsAppAdminCommand({
            admin: createAdminClient() as never,
            normalizedPhone: "+381600000000",
            content: "zapamti: faq | Keep forms complete",
            profileId: "profile_1",
        });

        expect(result).toEqual({ handled: true, replySent: false });
    });
});
