import { describe, expect, it } from "vitest";
import { isAutomatedNotificationSender } from "@/lib/email-skip-filter";

describe("isAutomatedNotificationSender", () => {
    it("blocks Netlify form-notification senders (the bounce-loop source)", () => {
        expect(isAutomatedNotificationSender("formresponses@netlify.com")).toBe(true);
        expect(isAutomatedNotificationSender("formresponses+noreply@netlify.com")).toBe(true);
        expect(isAutomatedNotificationSender("anything@subdomain.netlify.com")).toBe(true);
    });

    it("blocks web3forms notification senders", () => {
        expect(isAutomatedNotificationSender("notify+fn3hxr@web3forms.com")).toBe(true);
        expect(isAutomatedNotificationSender("notify+zod7om@web3forms.com")).toBe(true);
    });

    it("blocks generic no-reply / bounce / mailer-daemon addresses", () => {
        expect(isAutomatedNotificationSender("noreply@github.com")).toBe(true);
        expect(isAutomatedNotificationSender("no-reply@example.com")).toBe(true);
        expect(isAutomatedNotificationSender("do-not-reply@example.com")).toBe(true);
        expect(isAutomatedNotificationSender("mailer-daemon@gmail.com")).toBe(true);
        expect(isAutomatedNotificationSender("postmaster@gmail.com")).toBe(true);
        expect(isAutomatedNotificationSender("bounce@mail.example.com")).toBe(true);
        expect(isAutomatedNotificationSender("notifications@slack.com")).toBe(true);
    });

    it("still allows real people so genuine inquiries get a reply", () => {
        expect(isAutomatedNotificationSender("tatjana970@gmail.com")).toBe(false);
        expect(isAutomatedNotificationSender("borivoje@prunus.rs")).toBe(false);
        expect(isAutomatedNotificationSender("info@company.com")).toBe(false);
        expect(isAutomatedNotificationSender("trevor.smith@outlook.com")).toBe(false);
    });

    it("handles missing / malformed input safely", () => {
        expect(isAutomatedNotificationSender("")).toBe(false);
        expect(isAutomatedNotificationSender(null)).toBe(false);
        expect(isAutomatedNotificationSender(undefined)).toBe(false);
        expect(isAutomatedNotificationSender("not-an-email")).toBe(false);
        // No local part -> treated as invalid here (the cron rejects it earlier as invalid_sender).
        expect(isAutomatedNotificationSender("@netlify.com")).toBe(false);
    });

    it("is case-insensitive", () => {
        expect(isAutomatedNotificationSender("FormResponses@Netlify.com")).toBe(true);
        expect(isAutomatedNotificationSender("NoReply@Example.com")).toBe(true);
    });
});
