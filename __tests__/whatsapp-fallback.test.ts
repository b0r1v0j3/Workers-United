import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPlatformConfig } = vi.hoisted(() => ({
    getPlatformConfig: vi.fn(),
}));

vi.mock("@/lib/platform-config", () => ({
    getPlatformConfig,
}));

import { getWhatsAppFallbackResponse } from "@/lib/whatsapp-fallback";

describe("whatsapp-fallback", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getPlatformConfig.mockResolvedValue({
            entry_fee: "$9",
            website_url: "https://www.workersunited.eu",
            bot_greeting_en: "Welcome to Workers United!",
            bot_greeting_sr: "Dobrodošli u Workers United!",
        });
    });

    it("gives unregistered users the direct fee and admin-approval answer for price questions", async () => {
        const reply = await getWhatsAppFallbackResponse("price please", null, {
            full_name: "Ali Worker",
        });

        expect(reply).toContain("https://www.workersunited.eu/signup");
        expect(reply).toContain("$9");
        expect(reply).toContain("admin approval");
        expect(reply).not.toContain("Welcome to Workers United!");
    });

    it("keeps locked workers on the admin-review/payment gate", async () => {
        const reply = await getWhatsAppFallbackResponse("payment", {
            status: "PENDING_APPROVAL",
            entry_fee_paid: false,
            admin_approved: false,
            queue_joined_at: null,
        }, {
            full_name: "Ali Worker",
        });

        expect(reply).toContain("not unlocked yet");
        expect(reply).toContain("admin review");
        expect(reply).toContain("https://www.workersunited.eu/profile/worker");
    });

    it("returns the stricter diploma/document guidance", async () => {
        const reply = await getWhatsAppFallbackResponse("passport and document", {
            status: "NEW",
            entry_fee_paid: false,
            admin_approved: false,
            queue_joined_at: null,
        }, {
            full_name: "Ali Worker",
        });

        expect(reply).toContain("passport");
        expect(reply).toContain("biometric photo");
        expect(reply).toContain("formal vocational diploma");
        expect(reply).toContain("not linked to the profile automatically");
    });

    it("keeps warm greetings human for unregistered users", async () => {
        const reply = await getWhatsAppFallbackResponse("zdravo kako si danas", null, {
            full_name: "Ali Worker",
        });

        expect(reply).toContain("Workers United AI asistent");
        expect(reply).not.toContain("Create your account");
    });

    it("keeps short warm greetings in French instead of falling back to English", async () => {
        const reply = await getWhatsAppFallbackResponse("Comment ça va", null, {
            full_name: "Ali Worker",
        });

        expect(reply).toContain("Je suis l’assistant IA");
        expect(reply).not.toContain("Create your account");
    });

    it("keeps transliterated Hindi warm greetings in Hindi fallback copy", async () => {
        const reply = await getWhatsAppFallbackResponse("kaise ho", null, {
            full_name: "Ali Worker",
        });

        expect(reply).toContain("Workers United का AI assistant");
        expect(reply).not.toContain("Create your account");
    });

    it("honors explicit language-switch requests instead of falling back to English", async () => {
        const reply = await getWhatsAppFallbackResponse("Pisi na srpskom", null, {
            full_name: "Ali Worker",
        }, "English");

        expect(reply).toContain("Nastaviću na srpskom");
        expect(reply).not.toContain("Welcome to Workers United");
    });

    it("uses recent conversation language for short ambiguous fallback follow-ups", async () => {
        const reply = await getWhatsAppFallbackResponse("ok", null, {
            full_name: "Ali Worker",
        }, "English", [
            { direction: "inbound", content: "Bonjour, ça va ?" },
        ]);

        expect(reply).toContain("Bienvenue");
        expect(reply).not.toContain("Welcome to Workers United");
    });
});
