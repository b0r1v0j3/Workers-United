import Stripe from "stripe";
import { buildPlatformUrl, normalizePlatformWebsiteUrl } from "@/lib/platform-contact";

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
    const baseUrl = normalizePlatformWebsiteUrl(
        process.env.NEXT_PUBLIC_BASE_URL
        || process.env.NEXT_PUBLIC_APP_URL
        || process.env.VERCEL_URL
        || "http://localhost:3000"
    );
    const url = new URL(path, baseUrl);
    url.searchParams.set("payment", paymentState);
    if (includeSessionId) {
        url.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");
    }
    return url.toString();
}

export function getCheckoutSuccessUrl(type: PaymentType, offerId?: string, overridePath?: string | null): string {
    if (overridePath) {
        return buildRedirectUrl(overridePath, "success", true);
    }

    switch (type) {
        case "entry_fee":
            return buildRedirectUrl("/profile/worker/queue", "success", true);
        case "confirmation_fee":
            return offerId
                ? buildRedirectUrl(`/profile/worker/offers/${offerId}`, "success", true)
                : buildRedirectUrl("/profile/worker/queue", "success", true);
        default:
            return buildPlatformUrl(process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || "http://localhost:3000", "/profile/worker");
    }
}

export function getCheckoutCancelUrl(type: PaymentType, offerId?: string, overridePath?: string | null): string {
    if (overridePath) {
        return buildRedirectUrl(overridePath, "cancelled", false);
    }

    switch (type) {
        case "entry_fee":
            return buildRedirectUrl("/profile/worker/queue", "cancelled", false);
        case "confirmation_fee":
            return offerId
                ? buildRedirectUrl(`/profile/worker/offers/${offerId}`, "cancelled", false)
                : buildRedirectUrl("/profile/worker/queue", "cancelled", false);
        default:
            return buildPlatformUrl(process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || "http://localhost:3000", "/profile/worker");
    }
}
