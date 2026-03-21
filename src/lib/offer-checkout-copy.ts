export const OFFER_CHECKOUT_SUMMARY_LABEL = "Offer confirmation payment";
export const OFFER_CHECKOUT_SUMMARY_VALUE = "Shown in secure checkout";
export const OFFER_CHECKOUT_HELP_TEXT = "Secure checkout shows the current placement amount for this case before you pay.";

export function getOfferCheckoutCta(variant: "page" | "card" = "page"): string {
    return variant === "card" ? "Review offer & continue" : "Confirm offer & continue";
}
