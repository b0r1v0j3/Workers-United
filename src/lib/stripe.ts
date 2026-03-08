import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY || "";

export const stripe = new Stripe(secretKey, {
    apiVersion: "2024-04-10",
    typescript: true,
});


export const PRICES = {
    ENTRY_FEE: {
        amount: 900, // $9.00 in cents
        priceId: process.env.STRIPE_ENTRY_FEE_PRICE_ID || "",
    },
    CONFIRMATION_FEE: {
        amount: 19000, // $190.00 in cents
        priceId: process.env.STRIPE_CONFIRMATION_FEE_PRICE_ID || "",
    },
} as const;

export type PaymentType = "entry_fee" | "confirmation_fee";

function buildRedirectUrl(path: string, paymentState: "success" | "cancelled", includeSessionId: boolean): string {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const url = new URL(path, baseUrl);
    url.searchParams.set("payment", paymentState);
    if (includeSessionId) {
        url.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");
    }
    return url.toString();
}

export function getCheckoutSuccessUrl(type: PaymentType, offerId?: string, overridePath?: string | null): string {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const sessionParam = "session_id={CHECKOUT_SESSION_ID}";

    if (overridePath) {
        return buildRedirectUrl(overridePath, "success", true);
    }

    switch (type) {
        case "entry_fee":
            return `${baseUrl}/profile/worker/queue?payment=success&${sessionParam}`;
        case "confirmation_fee":
            return offerId
                ? `${baseUrl}/profile/worker/offers/${offerId}?payment=success&${sessionParam}`
                : `${baseUrl}/profile/worker/queue?payment=success&${sessionParam}`;
        default:
            return `${baseUrl}/profile/worker`;
    }
}

export function getCheckoutCancelUrl(type: PaymentType, offerId?: string, overridePath?: string | null): string {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    if (overridePath) {
        return buildRedirectUrl(overridePath, "cancelled", false);
    }

    switch (type) {
        case "entry_fee":
            return `${baseUrl}/profile/worker/queue?payment=cancelled`;
        case "confirmation_fee":
            return offerId
                ? `${baseUrl}/profile/worker/offers/${offerId}?payment=cancelled`
                : `${baseUrl}/profile/worker/queue?payment=cancelled`;
        default:
            return `${baseUrl}/profile/worker`;
    }
}
