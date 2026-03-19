import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const constructEvent = vi.fn();
const createAdminClient = vi.fn();
const handleStripePaymentIntentFailedEvent = vi.fn();
const handleStripeChargeFailedEvent = vi.fn();
const handleStripeCheckoutSessionCompletedEvent = vi.fn();
const handleStripeCheckoutSessionExpiredEvent = vi.fn();

vi.mock("stripe", () => {
    return {
        default: class StripeMock {
            webhooks = {
                constructEvent,
            };
        },
    };
});

vi.mock("@/lib/supabase/admin", () => ({
    createAdminClient,
}));

vi.mock("@/lib/stripe-webhook-handlers", () => ({
    handleStripePaymentIntentFailedEvent,
    handleStripeChargeFailedEvent,
    handleStripeCheckoutSessionCompletedEvent,
    handleStripeCheckoutSessionExpiredEvent,
}));

describe("POST /api/stripe/webhook", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        createAdminClient.mockReturnValue({ admin: true });
        process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    });

    it("returns 400 when stripe-signature header is missing", async () => {
        const { POST } = await import("@/app/api/stripe/webhook/route");
        const request = new NextRequest("http://localhost/api/stripe/webhook", {
            method: "POST",
            body: "{}",
        });

        const response = await POST(request);
        const payload = await response.json();

        expect(response.status).toBe(400);
        expect(payload).toEqual({ error: "Missing stripe-signature header" });
    });

    it("dispatches payment_intent.payment_failed events to the dedicated handler", async () => {
        constructEvent.mockReturnValue({
            type: "payment_intent.payment_failed",
            data: {
                object: {
                    id: "pi_123",
                },
            },
        });
        handleStripePaymentIntentFailedEvent.mockResolvedValue({
            body: { received: true, source: "payment_intent" },
        });

        const { POST } = await import("@/app/api/stripe/webhook/route");
        const request = new NextRequest("http://localhost/api/stripe/webhook", {
            method: "POST",
            body: "{}",
            headers: {
                "stripe-signature": "sig_test",
            },
        });

        const response = await POST(request);
        const payload = await response.json();

        expect(handleStripePaymentIntentFailedEvent).toHaveBeenCalledWith(
            { admin: true },
            { id: "pi_123" }
        );
        expect(payload).toEqual({ received: true, source: "payment_intent" });
    });
});
