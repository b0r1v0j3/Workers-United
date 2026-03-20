import { afterEach, describe, expect, it } from "vitest";
import { getCheckoutCancelUrl, getCheckoutSuccessUrl } from "@/lib/stripe";

describe("stripe redirect URLs", () => {
    const originalBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
    const originalVercelUrl = process.env.VERCEL_URL;

    afterEach(() => {
        process.env.NEXT_PUBLIC_BASE_URL = originalBaseUrl;
        process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
        process.env.VERCEL_URL = originalVercelUrl;
    });

    it("normalizes bare NEXT_PUBLIC_BASE_URL for success and cancel redirects", () => {
        process.env.NEXT_PUBLIC_BASE_URL = "workersunited.example";
        delete process.env.NEXT_PUBLIC_APP_URL;
        delete process.env.VERCEL_URL;

        expect(getCheckoutSuccessUrl("entry_fee")).toBe(
            "https://workersunited.example/profile/worker/queue?payment=success&session_id=%7BCHECKOUT_SESSION_ID%7D"
        );
        expect(getCheckoutCancelUrl("confirmation_fee", "offer-123")).toBe(
            "https://workersunited.example/profile/worker/offers/offer-123?payment=cancelled"
        );
    });

    it("uses VERCEL_URL when public app URLs are absent", () => {
        delete process.env.NEXT_PUBLIC_BASE_URL;
        delete process.env.NEXT_PUBLIC_APP_URL;
        process.env.VERCEL_URL = "workers-united-preview.vercel.app";

        expect(getCheckoutSuccessUrl("confirmation_fee", "offer-987")).toBe(
            "https://workers-united-preview.vercel.app/profile/worker/offers/offer-987?payment=success&session_id=%7BCHECKOUT_SESSION_ID%7D"
        );
    });

    it("keeps override paths on the same normalized host", () => {
        process.env.NEXT_PUBLIC_BASE_URL = "https://workersunited.eu";
        delete process.env.NEXT_PUBLIC_APP_URL;
        delete process.env.VERCEL_URL;

        expect(getCheckoutCancelUrl("entry_fee", undefined, "/profile/worker?tab=queue")).toBe(
            "https://workersunited.eu/profile/worker?tab=queue&payment=cancelled"
        );
    });
});
