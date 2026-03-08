import { describe, expect, it } from "vitest";
import {
    isRecipientSideWhatsAppFailure,
    summarizeWhatsAppTemplateHealth,
} from "@/lib/whatsapp-health";

describe("whatsapp health helpers", () => {
    it("classifies undeliverable and country-restricted errors as recipient-side", () => {
        expect(isRecipientSideWhatsAppFailure("131026: Message undeliverable")).toBe(true);
        expect(isRecipientSideWhatsAppFailure("130497: Business account is restricted from messaging users in this country.")).toBe(true);
        expect(isRecipientSideWhatsAppFailure("(#132018) There’s an issue with the parameters in your template")).toBe(false);
    });

    it("keeps health ok when failures are only recipient-side", () => {
        const summary = summarizeWhatsAppTemplateHealth({
            totalOutboundTemplates: 10,
            failedMessages: [
                { errorMessage: "131026: Message undeliverable" },
                { errorMessage: "130497: Business account is restricted from messaging users in this country." },
            ],
        });

        expect(summary.state).toBe("ok");
        expect(summary.details).toContain("recipient-side delivery block");
        expect(summary.platformFailures).toBe(0);
        expect(summary.recipientFailures).toBe(2);
    });

    it("marks health degraded when platform-side template errors exist", () => {
        const summary = summarizeWhatsAppTemplateHealth({
            totalOutboundTemplates: 12,
            failedMessages: [
                { errorMessage: "(#132018) There’s an issue with the parameters in your template" },
                { errorMessage: "131026: Message undeliverable" },
            ],
        });

        expect(summary.state).toBe("degraded");
        expect(summary.details).toContain("platform-side template failure");
        expect(summary.details).toContain("Recipient-side delivery blocks: 1");
        expect(summary.platformFailures).toBe(1);
    });
});
