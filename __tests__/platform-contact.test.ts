import { describe, expect, it } from "vitest";
import {
    DEFAULT_PLATFORM_WHATSAPP_NUMBER,
    buildPlatformWhatsAppUrl,
    normalizePlatformWhatsAppNumber,
} from "@/lib/platform-contact";

describe("platform-contact", () => {
    it("normalizes formatted WhatsApp numbers to digits", () => {
        expect(normalizePlatformWhatsAppNumber("+1 (555) 783-9521")).toBe(DEFAULT_PLATFORM_WHATSAPP_NUMBER);
    });

    it("falls back to the canonical WhatsApp number when missing", () => {
        expect(buildPlatformWhatsAppUrl("   ")).toBe(`https://wa.me/${DEFAULT_PLATFORM_WHATSAPP_NUMBER}`);
    });

    it("encodes optional WhatsApp greeting text", () => {
        expect(buildPlatformWhatsAppUrl(undefined, "Hi, I have a question about Workers United")).toBe(
            `https://wa.me/${DEFAULT_PLATFORM_WHATSAPP_NUMBER}?text=Hi%2C%20I%20have%20a%20question%20about%20Workers%20United`
        );
    });
});
