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

    it("keeps unregistered fallback on the generic signup/start guidance", async () => {
        const reply = await getWhatsAppFallbackResponse("price please", null, {
            full_name: "Ali Worker",
        });

        expect(reply).toContain("https://www.workersunited.eu/signup");
        expect(reply).toContain("Job Finder unlocks only after the profile is complete and admin approves it.");
        expect(reply).toContain("Welcome to Workers United!");
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
});
