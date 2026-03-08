import { describe, expect, it } from "vitest";
import {
    getSuggestedEmailCorrection,
    hasKnownInvalidOnlyEmailDomain,
    hasKnownTypoEmailDomain,
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

    it("detects common undeliverable email failures", () => {
        expect(isLikelyUndeliverableEmailError("550 5.1.1 The email account that you tried to reach does not exist")).toBe(true);
        expect(isLikelyUndeliverableEmailError("DNS Error: DNS type 'mx' lookup of yahoo.coms responded with code NXDOMAIN")).toBe(true);
        expect(isLikelyUndeliverableEmailError("Temporary timeout while sending")).toBe(false);
    });
});
