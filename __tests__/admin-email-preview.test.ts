import { describe, expect, it } from "vitest";
import {
    buildAdminEmailPreviewHref,
    isAdminEmailPreviewType,
    parseAdminEmailPreviewData,
} from "@/lib/admin-email-preview";

describe("admin-email-preview", () => {
    it("builds preview hrefs with serialized payload data", () => {
        const href = buildAdminEmailPreviewHref("document_review_result", {
            name: "Marko Petrovic",
            approved: false,
            docType: "Passport",
            feedback: "Please upload a clearer passport photo.",
        });

        const url = new URL(`https://workersunited.eu${href}`);
        expect(url.pathname).toBe("/admin/email-preview");
        expect(url.searchParams.get("type")).toBe("document_review_result");
        expect(url.searchParams.get("data")).toContain("\"docType\":\"Passport\"");
    });

    it("supports custom preview base paths for internal tools", () => {
        const href = buildAdminEmailPreviewHref(
            "document_review_result",
            { approved: true, docType: "Passport" },
            "/internal/email-preview"
        );

        expect(href.startsWith("/internal/email-preview?")).toBe(true);
    });

    it("accepts only supported admin preview email types", () => {
        expect(isAdminEmailPreviewType("document_review_result")).toBe(true);
        expect(isAdminEmailPreviewType("welcome")).toBe(true);
        expect(isAdminEmailPreviewType("not_real")).toBe(false);
        expect(isAdminEmailPreviewType(null)).toBe(false);
    });

    it("parses only scalar preview values from query payloads", () => {
        const parsed = parseAdminEmailPreviewData(JSON.stringify({
            name: "Marko Petrovic",
            approved: true,
            docType: "Passport",
            feedback: "Looks good.",
            ignored: { nested: true },
            list: ["a", "b"],
        }));

        expect(parsed).toEqual({
            name: "Marko Petrovic",
            approved: true,
            docType: "Passport",
            feedback: "Looks good.",
        });
    });
});
