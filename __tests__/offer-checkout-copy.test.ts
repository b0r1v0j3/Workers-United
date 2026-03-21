import { describe, expect, it } from "vitest";
import {
    getOfferCheckoutCta,
    OFFER_CHECKOUT_HELP_TEXT,
    OFFER_CHECKOUT_SUMMARY_LABEL,
    OFFER_CHECKOUT_SUMMARY_VALUE,
} from "@/lib/offer-checkout-copy";

describe("offer-checkout-copy", () => {
    it("keeps placement checkout copy generic instead of hardcoding one country amount", () => {
        expect(OFFER_CHECKOUT_SUMMARY_LABEL).toBe("Offer confirmation payment");
        expect(OFFER_CHECKOUT_SUMMARY_VALUE).toBe("Shown in secure checkout");
        expect(OFFER_CHECKOUT_HELP_TEXT).toContain("current placement amount");
        expect(OFFER_CHECKOUT_SUMMARY_VALUE).not.toContain("$190");
        expect(OFFER_CHECKOUT_HELP_TEXT).not.toContain("$190");
    });

    it("returns offer checkout CTA labels for the worker offer surfaces", () => {
        expect(getOfferCheckoutCta()).toBe("Confirm offer & continue");
        expect(getOfferCheckoutCta("card")).toBe("Review offer & continue");
    });
});
