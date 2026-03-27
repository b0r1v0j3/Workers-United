import { describe, expect, it } from "vitest";
import {
    loadRecentConversations,
    analyzeConversations,
} from "@/lib/whatsapp-self-improve";

// ─── Mock DB client ──────────────────────────────────────────────────────────

type LoadRecentConversationsAdmin = Parameters<typeof loadRecentConversations>[0];

function createMockAdmin(rows: unknown[] | null = [], error: { message: string } | null = null) {
    return {
        from: () => ({
            select: () => ({
                gte: () => ({
                    in: () => ({
                        not: () => ({
                            order: () => ({
                                limit: () => Promise.resolve({ data: rows, error }),
                            }),
                        }),
                    }),
                }),
            }),
        }),
    } as LoadRecentConversationsAdmin;
}

// ─── loadRecentConversations ─────────────────────────────────────────────────

describe("loadRecentConversations", () => {
    it("groups messages into threads by phone number", async () => {
        const rows = [
            { phone_number: "+111", direction: "inbound", content: "Hello", created_at: "2026-03-23T10:00:00Z" },
            { phone_number: "+111", direction: "outbound", content: "Hi there!", created_at: "2026-03-23T10:00:05Z" },
            { phone_number: "+222", direction: "inbound", content: "Need help", created_at: "2026-03-23T10:01:00Z" },
        ];

        const threads = await loadRecentConversations(createMockAdmin(rows));
        expect(threads).toHaveLength(2);
        expect(threads[0].phone).toBe("+111");
        expect(threads[0].messages).toHaveLength(2);
        expect(threads[1].phone).toBe("+222");
        expect(threads[1].messages).toHaveLength(1);
    });

    it("skips template messages", async () => {
        const rows = [
            { phone_number: "+111", direction: "inbound", content: "Hi", created_at: "2026-03-23T10:00:00Z" },
            { phone_number: "+111", direction: "outbound", content: "[Template: status_update] Your profile...", created_at: "2026-03-23T10:00:05Z" },
        ];

        const threads = await loadRecentConversations(createMockAdmin(rows));
        expect(threads).toHaveLength(1);
        expect(threads[0].messages).toHaveLength(1);
        expect(threads[0].messages[0].content).toBe("Hi");
    });

    it("filters out threads with no inbound messages", async () => {
        const rows = [
            { phone_number: "+111", direction: "outbound", content: "Proactive nudge", created_at: "2026-03-23T10:00:00Z" },
        ];

        const threads = await loadRecentConversations(createMockAdmin(rows));
        expect(threads).toHaveLength(0);
    });

    it("returns empty array when no data", async () => {
        const threads = await loadRecentConversations(createMockAdmin([]));
        expect(threads).toHaveLength(0);
    });

    it("throws on DB error", async () => {
        await expect(
            loadRecentConversations(createMockAdmin(null, { message: "DB down" }))
        ).rejects.toThrow("Failed to load conversations: DB down");
    });
});

// ─── analyzeConversations ────────────────────────────────────────────────────

describe("analyzeConversations", () => {
    it("returns empty report for no threads", async () => {
        const report = await analyzeConversations("fake-key", [], []);
        expect(report.analyzed_threads).toBe(0);
        expect(report.insights).toHaveLength(0);
        expect(report.summary).toBe("No conversations to analyze.");
    });
});
