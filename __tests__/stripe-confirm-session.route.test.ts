import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const retrieve = vi.fn();
const createClient = vi.fn();
const createAdminClient = vi.fn();
const logServerActivity = vi.fn();
const finalizeConfirmationFeeOffer = vi.fn();
const activateEntryFeeWorkerAfterPayment = vi.fn();
const persistCompletedStripeCheckoutPayment = vi.fn();
const queueEntryFeePaymentSuccessEmail = vi.fn();
const buildStripePaymentCompletedActivityPayload = vi.fn((payload) => payload);
const buildStripePaymentFailedActivityPayload = vi.fn((payload) => payload);
const getStripePaymentAmounts = vi.fn(() => ({ amount: 9, amountCents: 900 }));

vi.mock("stripe", () => {
    return {
        default: class StripeMock {
            checkout = {
                sessions: {
                    retrieve,
                },
            };
        },
    };
});

vi.mock("@/lib/supabase/server", () => ({
    createClient,
}));

vi.mock("@/lib/supabase/admin", () => ({
    createAdminClient,
}));

vi.mock("@/lib/activityLoggerServer", () => ({
    logServerActivity,
}));

vi.mock("@/lib/offer-finalization", () => ({
    finalizeConfirmationFeeOffer,
}));

vi.mock("@/lib/stripe-payment-finalization", () => ({
    activateEntryFeeWorkerAfterPayment,
    buildStripePaymentCompletedActivityPayload,
    buildStripePaymentFailedActivityPayload,
    getStripePaymentAmounts,
    persistCompletedStripeCheckoutPayment,
    queueEntryFeePaymentSuccessEmail,
}));

describe("POST /api/stripe/confirm-session", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.STRIPE_SECRET_KEY = "sk_test_123";
        createClient.mockResolvedValue({
            auth: {
                getUser: vi.fn().mockResolvedValue({
                    data: {
                        user: {
                            id: "user-1",
                        },
                    },
                }),
            },
        });
        createAdminClient.mockReturnValue({
            from: vi.fn(),
        });
        retrieve.mockResolvedValue({
            id: "cs_test_123",
            metadata: {
                user_id: "user-1",
                payment_type: "entry_fee",
                target_profile_id: "profile-1",
                paid_by_profile_id: "profile-1",
            },
            payment_status: "paid",
            status: "complete",
            amount_total: 900,
            currency: "usd",
            customer_email: "worker@example.com",
            customer_details: {
                address: {
                    country: "MA",
                    postal_code: "10000",
                },
            },
        });
        persistCompletedStripeCheckoutPayment.mockResolvedValue(undefined);
        activateEntryFeeWorkerAfterPayment.mockResolvedValue(undefined);
    });

    it("logs a queued payment success email result", async () => {
        queueEntryFeePaymentSuccessEmail.mockResolvedValue({
            status: "queued",
            recipientEmail: "worker@example.com",
        });

        const { POST } = await import("@/app/api/stripe/confirm-session/route");
        const request = new NextRequest("http://localhost/api/stripe/confirm-session", {
            method: "POST",
            body: JSON.stringify({ sessionId: "cs_test_123" }),
        });

        const response = await POST(request);
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload).toEqual({
            state: "paid",
            paymentType: "entry_fee",
            message: "Payment verified and worker queue status activated.",
        });
        expect(logServerActivity).toHaveBeenCalledWith(
            "profile-1",
            "payment_success_email_queued",
            "payment",
            expect.objectContaining({
                recipient_email: "worker@example.com",
                source: "confirm-session-route",
            })
        );
    });

    it("logs when the payment success email is skipped because the recipient is missing", async () => {
        queueEntryFeePaymentSuccessEmail.mockResolvedValue({
            status: "missing_recipient",
        });

        const { POST } = await import("@/app/api/stripe/confirm-session/route");
        const request = new NextRequest("http://localhost/api/stripe/confirm-session", {
            method: "POST",
            body: JSON.stringify({ sessionId: "cs_test_123" }),
        });

        await POST(request);

        expect(logServerActivity).toHaveBeenCalledWith(
            "profile-1",
            "payment_success_email_skipped",
            "payment",
            expect.objectContaining({
                reason: "No recipient email found in session/customer/profile",
                source: "confirm-session-route",
            }),
            "warning"
        );
    });
});
