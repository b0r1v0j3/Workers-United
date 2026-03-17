import { describe, expect, it } from "vitest";
import {
    getSuggestedEmailCorrection,
    hasKnownInvalidOnlyEmailDomain,
    hasKnownTypoEmailDomain,
    isInternalOrTestEmail,
    isLikelyUndeliverableEmailError,
    isReportablePaymentProfile,
} from "@/lib/reporting";

describe("reporting email hygiene helpers", () => {
    it("detects typo domains and suggests a correction", () => {
        expect(hasKnownTypoEmailDomain("worker@gmai.com")).toBe(true);
        expect(getSuggestedEmailCorrection("worker@gmai.com")).toBe("worker@gmail.com");
    });

    it("treats workersunited.org as invalid-only for reporting", () => {
        expect(hasKnownInvalidOnlyEmailDomain("borivoje@workersunited.org")).toBe(true);
        expect(isReportablePaymentProfile({ email: "borivoje@workersunited.org" })).toBe(false);
    });

    it("treats internal draft and debug domains as non-reportable contacts", () => {
        expect(isInternalOrTestEmail("draft-worker-123@workersunited.internal")).toBe(true);
        expect(isInternalOrTestEmail("codex-worker-storage-123@workersunited.dev")).toBe(true);
        expect(hasKnownInvalidOnlyEmailDomain("codex-worker-storage-123@workersunited.dev")).toBe(true);
        expect(isReportablePaymentProfile({ email: "codex-worker-storage-123@workersunited.dev" })).toBe(false);
    });

    it("detects common undeliverable email failures", () => {
        expect(isLikelyUndeliverableEmailError("550 5.1.1 The email account that you tried to reach does not exist")).toBe(true);
        expect(isLikelyUndeliverableEmailError("DNS Error: DNS type 'mx' lookup of yahoo.coms responded with code NXDOMAIN")).toBe(true);
        expect(isLikelyUndeliverableEmailError("Temporary timeout while sending")).toBe(false);
    });
});
