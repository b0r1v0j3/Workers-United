import { describe, expect, it } from "vitest";
import {
    applyWhatsAppReplyGuardrails,
    buildWorkerPaymentSnapshot,
    getMediaAttachmentResponse,
    isWorkerPaymentUnlocked,
} from "@/lib/whatsapp-reply-guardrails";

describe("whatsapp-reply-guardrails", () => {
    it("detects unlocked worker payment state only for approved unpaid workers", () => {
        expect(isWorkerPaymentUnlocked({
            entry_fee_paid: false,
            admin_approved: true,
            status: "APPROVED",
        })).toBe(true);

        expect(isWorkerPaymentUnlocked({
            entry_fee_paid: true,
            admin_approved: true,
            status: "APPROVED",
        })).toBe(false);
    });

    it("builds payment snapshot copy for the main worker states", () => {
        expect(buildWorkerPaymentSnapshot(null)).toContain("registration and profile completion come first");
        expect(buildWorkerPaymentSnapshot({
            entry_fee_paid: true,
            admin_approved: true,
            status: "IN_QUEUE",
        })).toContain("already paid");
        expect(buildWorkerPaymentSnapshot({
            entry_fee_paid: false,
            admin_approved: true,
            status: "APPROVED",
        })).toContain("worker is approved");
    });

    it("returns language-specific media fallback copy", () => {
        expect(getMediaAttachmentResponse("Serbian")).toContain("poslali prilog");
        expect(getMediaAttachmentResponse("English")).toContain("I received the attachment");
    });

    it("replaces escalation promises with deterministic support copy", () => {
        const result = applyWhatsAppReplyGuardrails({
            responseText: "I forwarded this to the tech team and they will reply here.",
            language: "English",
            workerRecord: {
                entry_fee_paid: true,
                admin_approved: true,
                status: "IN_QUEUE",
            },
        });

        expect(result.triggered).toBe(true);
        expect(result.reason).toBe("escalation");
        expect(result.text).toContain("support inbox in your dashboard");
    });

    it("blocks direct payment-link promises until dashboard checkout is allowed", () => {
        const result = applyWhatsAppReplyGuardrails({
            responseText: "I can send the payment link now.",
            language: "English",
            workerRecord: {
                entry_fee_paid: false,
                admin_approved: false,
                status: "PENDING_APPROVAL",
            },
        });

        expect(result.triggered).toBe(true);
        expect(result.reason).toBe("payment");
        expect(result.text).toContain("not unlocked for your account yet");
        expect(result.text).toContain("never from a WhatsApp link");
    });

    it("blocks job inventory claims with process-safe copy", () => {
        const result = applyWhatsAppReplyGuardrails({
            responseText: "We offer jobs across Europe and have verified workers available.",
            language: "English",
            workerRecord: null,
        });

        expect(result.triggered).toBe(true);
        expect(result.reason).toBeNull();
        expect(result.text).toContain("guided matching process");
    });

    it("passes through safe replies unchanged", () => {
        const result = applyWhatsAppReplyGuardrails({
            responseText: "Please log in to your dashboard to continue.",
            language: "English",
            workerRecord: null,
        });

        expect(result).toEqual({
            text: "Please log in to your dashboard to continue.",
            triggered: false,
            reason: null,
        });
    });
});
