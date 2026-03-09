import { describe, expect, it } from "vitest";
import { normalizeTemplateOptions, type SendTemplateOptions } from "@/lib/whatsapp";

describe("whatsapp template option normalization", () => {
    it("strips CTA buttons from profile_incomplete to match the approved live variant", () => {
        const options: SendTemplateOptions = {
            to: "+381600000121",
            templateName: "profile_incomplete",
            bodyParams: ["Codex", "almost ready", "complete your registration and join the job queue"],
            buttonParams: [{ type: "url", url: "/profile/worker/edit" }],
        };

        const normalized = normalizeTemplateOptions(options);

        expect(normalized.buttonParams).toBeUndefined();
        expect(normalized.bodyParams).toEqual(options.bodyParams);
    });

    it("keeps button params intact for templates that still use CTA buttons", () => {
        const options: SendTemplateOptions = {
            to: "+381600000121",
            templateName: "payment_confirmed",
            bodyParams: ["$9", "Codex"],
            buttonParams: [{ type: "url", url: "/profile/worker/queue" }],
        };

        const normalized = normalizeTemplateOptions(options);

        expect(normalized.buttonParams).toEqual(options.buttonParams);
    });
});
