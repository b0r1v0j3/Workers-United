import { describe, expect, it, vi } from "vitest";
import {
    buildWorkerSnapshot,
    classifyWhatsAppIntent,
    generateWorkerWhatsAppReply,
    type WhatsAppRouterDecision,
} from "@/lib/whatsapp-worker-ai";

describe("whatsapp-worker-ai", () => {
    it("builds a useful worker snapshot for registered workers", () => {
        const snapshot = buildWorkerSnapshot(
            {
                status: "PENDING_APPROVAL",
                entry_fee_paid: false,
                admin_approved: false,
                queue_joined_at: null,
                preferred_job: "Welder",
                nationality: "Moroccan",
                current_country: "Morocco",
            },
            {
                email: "worker@example.com",
            }
        );

        expect(snapshot).toContain("Registered: yes");
        expect(snapshot).toContain("Worker status: PENDING_APPROVAL");
        expect(snapshot).toContain("Preferred job: Welder");
        expect(snapshot).toContain("Email: worker@example.com");
    });

    it("falls back safely when router response is invalid", async () => {
        const decision = await classifyWhatsAppIntent({
            callResponseText: vi.fn().mockRejectedValue(new Error("boom")),
            model: "gpt-5-mini",
            message: "hello there",
            normalizedPhone: "+212600000000",
            workerRecord: null,
            profile: null,
            historyMessages: [],
        });

        expect(decision.intent).toBe("general");
        expect(decision.confidence).toBe("low");
        expect(decision.reason).toBe("Router fallback");
        expect(decision.language.length).toBeGreaterThan(0);
    });

    it("delegates worker response prompt building to injected OpenAI caller", async () => {
        const callResponseText = vi.fn().mockResolvedValue("Worker reply");
        const routerDecision: WhatsAppRouterDecision = {
            intent: "status",
            language: "English",
            confidence: "high",
            reason: "Asked about approval status",
        };

        const reply = await generateWorkerWhatsAppReply({
            callResponseText,
            model: "gpt-5.4-mini",
            message: "What is my status?",
            normalizedPhone: "+212600000000",
            workerRecord: {
                status: "PENDING_APPROVAL",
                entry_fee_paid: false,
                admin_approved: false,
                queue_joined_at: null,
                preferred_job: "Welder",
                nationality: "Moroccan",
                current_country: "Morocco",
            },
            profile: {
                email: "worker@example.com",
                full_name: "Ali Worker",
            },
            isAdmin: false,
            businessFacts: "Entry fee is $9.",
            brainMemory: [
                { category: "copy_rule", content: "Keep replies practical.", confidence: 0.9 },
            ],
            historyMessages: [
                { direction: "inbound", content: "What is my status?" },
            ],
            routerDecision,
        });

        expect(reply).toBe("Worker reply");
        expect(callResponseText).toHaveBeenCalledWith(expect.objectContaining({
            model: "gpt-5.4-mini",
            input: expect.stringContaining("Phone: +212600000000"),
            instructions: expect.stringContaining("You are the official WhatsApp assistant for Workers United."),
        }));
        expect(callResponseText).toHaveBeenCalledWith(expect.objectContaining({
            instructions: expect.stringContaining("Worker snapshot:"),
        }));
    });
});
