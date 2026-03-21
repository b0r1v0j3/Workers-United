import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPlatformConfig } = vi.hoisted(() => ({
    getPlatformConfig: vi.fn(),
}));

vi.mock("@/lib/platform-config", async () => {
    const actual = await vi.importActual<typeof import("@/lib/platform-config")>("@/lib/platform-config");
    return {
        ...actual,
        getPlatformConfig,
    };
});

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
        expect(reply).toContain("required documents");
        expect(reply).not.toContain("Welcome to Workers United!");
    });

    it("keeps French price fallback copy in French instead of collapsing to English", async () => {
        const reply = await getWhatsAppFallbackResponse("payment", null, {
            full_name: "Ali Worker",
        }, "French");

        expect(reply).toContain("Job Finder coûte");
        expect(reply).toContain("validation admin");
        expect(reply).not.toContain("Job Finder costs");
    });

    it("routes French prix questions to the price fallback branch", async () => {
        const reply = await getWhatsAppFallbackResponse("Quel est le prix ?", null, {
            full_name: "Ali Worker",
        }, "French");

        expect(reply).toContain("Job Finder coûte");
        expect(reply).not.toContain("Create your account");
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
        expect(reply).toContain("required documents");
        expect(reply).toContain("https://www.workersunited.eu/profile/worker");
    });

    it("keeps payment-ready fallback on unlocked dashboard checkout wording", async () => {
        const reply = await getWhatsAppFallbackResponse("payment", {
            status: "APPROVED",
            entry_fee_paid: false,
            admin_approved: true,
            queue_joined_at: null,
        }, {
            full_name: "Ali Worker",
        }, "English");

        expect(reply).toContain("Job Finder checkout is now unlocked in your dashboard");
        expect(reply).toContain("https://www.workersunited.eu/profile/worker");
        expect(reply).not.toContain("ready to activate");
    });

    it("keeps Portuguese document fallback copy in Portuguese instead of collapsing to English", async () => {
        const reply = await getWhatsAppFallbackResponse("documentos", {
            status: "NEW",
            entry_fee_paid: false,
            admin_approved: false,
            queue_joined_at: null,
        }, {
            full_name: "Ali Worker",
        }, "Portuguese");

        expect(reply).toContain("Envie os documentos");
        expect(reply).toContain("Os anexos do WhatsApp");
        expect(reply).not.toContain("Upload documents at");
    });

    it("routes Portuguese passaporte questions to the documents fallback branch", async () => {
        const reply = await getWhatsAppFallbackResponse("Preciso enviar passaporte", {
            status: "NEW",
            entry_fee_paid: false,
            admin_approved: false,
            queue_joined_at: null,
        }, {
            full_name: "Ali Worker",
        }, "Portuguese");

        expect(reply).toContain("Envie os documentos");
        expect(reply).toContain("passaporte");
        expect(reply).not.toContain("Seu status é");
    });

    it("returns the stricter diploma/document guidance", async () => {
        const reply = await getWhatsAppFallbackResponse("passport and document", {
            status: "NEW",
            entry_fee_paid: false,
            admin_approved: false,
            queue_joined_at: null,
        }, {
            full_name: "Ali Worker",
        }, "English");

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

    it("keeps explicit language-switch history for short ambiguous fallback replies", async () => {
        const reply = await getWhatsAppFallbackResponse("ok", null, {
            full_name: "Ali Worker",
        }, "English", [
            { direction: "inbound", content: "Pisi na srpskom" },
            { direction: "outbound", content: "Naravno — nastaviću na srpskom." },
        ]);

        expect(reply).toContain("Dobrodošli u Workers United");
        expect(reply).toContain("Registrujte se");
        expect(reply).not.toContain("Welcome to Workers United");
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

    it("does not force French fallback copy onto short English status questions", async () => {
        const reply = await getWhatsAppFallbackResponse("What is my status?", {
            status: "PENDING_APPROVAL",
            queue_position: 4,
            entry_fee_paid: false,
            admin_approved: false,
            queue_joined_at: null,
        }, {
            full_name: "Ali Worker",
        }, "English", [
            { direction: "inbound", content: "Bonjour, ça va ?" },
        ]);

        expect(reply).toContain("Your status is:");
        expect(reply).not.toContain("Votre statut est");
    });

    it("normalizes bare platform website URLs before composing fallback links", async () => {
        getPlatformConfig.mockResolvedValue({
            entry_fee: "$9",
            website_url: "workersunited.example",
            bot_greeting_en: "Welcome to Workers United!",
            bot_greeting_sr: "Dobrodošli u Workers United!",
        });

        const reply = await getWhatsAppFallbackResponse("price please", null, {
            full_name: "Ali Worker",
        });

        expect(reply).toContain("https://workersunited.example/signup");
    });

    it("keeps fallback status replies human-friendly and localized", async () => {
        const reply = await getWhatsAppFallbackResponse("Quel est le statut ?", {
            status: "PENDING_APPROVAL",
            queue_position: 4,
            entry_fee_paid: false,
            admin_approved: false,
            queue_joined_at: null,
        }, {
            full_name: "Ali Worker",
        }, "French");

        expect(reply).toContain("profil en validation admin");
        expect(reply).toContain("Position dans la file: #4.");
        expect(reply).not.toContain("PENDING_APPROVAL");
    });

    it("localizes advanced paid worker statuses instead of exposing raw enums", async () => {
        const reply = await getWhatsAppFallbackResponse("Quel est le statut ?", {
            status: "VISA_PROCESS_STARTED",
            queue_position: null,
            entry_fee_paid: true,
            admin_approved: true,
            queue_joined_at: "2026-03-20T10:00:00.000Z",
        }, {
            full_name: "Ali Worker",
        }, "French");

        expect(reply).toContain("procédure de visa en cours");
        expect(reply).not.toContain("VISA_PROCESS_STARTED");
    });

    it("keeps generic signup fallback on checkout wording instead of vague unlock wording", async () => {
        const reply = await getWhatsAppFallbackResponse("help", null, {
            full_name: "Ali Worker",
        }, "English");

        expect(reply).toContain("Job Finder checkout opens only after");
        expect(reply).not.toContain("Job Finder unlocks only after");
    });
});
