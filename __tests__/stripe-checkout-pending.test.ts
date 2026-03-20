import { describe, expect, it, vi, beforeEach } from "vitest";

const { updateStripePaymentRecordByReference } = vi.hoisted(() => ({
    updateStripePaymentRecordByReference: vi.fn(),
}));

vi.mock("@/lib/stripe-payment-finalization", () => ({
    updateStripePaymentRecordByReference,
}));

import {
    findReusableStripeCheckoutPayment,
    markStripeCheckoutCreationFailed,
} from "@/lib/stripe-checkout-pending";

describe("stripe-checkout-pending helpers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns the newest matching pending checkout payment", async () => {
        const limit = vi.fn().mockResolvedValue({
            data: [
                {
                    id: "payment-old",
                    user_id: "profile-1",
                    profile_id: "profile-1",
                    status: "pending",
                    stripe_checkout_session_id: null,
                    deadline_at: "2026-03-22T10:00:00.000Z",
                    metadata: {
                        checkout_started_at: "2026-03-19T10:00:00.000Z",
                        offer_id: "offer-1",
                    },
                },
                {
                    id: "payment-new",
                    user_id: "profile-1",
                    profile_id: "profile-1",
                    status: "pending",
                    stripe_checkout_session_id: "cs_test_123",
                    deadline_at: "2026-03-22T12:00:00.000Z",
                    metadata: {
                        checkout_started_at: "2026-03-19T12:00:00.000Z",
                        offer_id: "offer-1",
                    },
                },
                {
                    id: "payment-other-offer",
                    user_id: "profile-1",
                    profile_id: "profile-1",
                    status: "pending",
                    stripe_checkout_session_id: "cs_test_999",
                    deadline_at: "2026-03-22T13:00:00.000Z",
                    metadata: {
                        checkout_started_at: "2026-03-19T13:00:00.000Z",
                        offer_id: "offer-2",
                    },
                },
            ],
            error: null,
        });
        const query = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            contains: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit,
        };
        const admin = {
            from: vi.fn().mockReturnValue(query),
        };

        const payment = await findReusableStripeCheckoutPayment({
            admin: admin as never,
            paymentType: "confirmation_fee",
            paymentOwnerProfileId: "profile-1",
            offerId: "offer-1",
        });

        expect(payment?.id).toBe("payment-new");
        expect(query.eq).toHaveBeenCalledWith("payment_type", "confirmation_fee");
        expect(query.or).toHaveBeenCalledWith("user_id.eq.profile-1,profile_id.eq.profile-1");
    });

    it("marks failed checkout creation as abandoned without losing metadata updates", async () => {
        updateStripePaymentRecordByReference.mockResolvedValue(undefined);

        await markStripeCheckoutCreationFailed({
            admin: { from: vi.fn() } as never,
            paymentId: "payment-1",
            paymentType: "entry_fee",
            error: new Error("stripe session create failed"),
        });

        expect(updateStripePaymentRecordByReference).toHaveBeenCalledWith({
            admin: { from: expect.any(Function) },
            paymentId: "payment-1",
            pendingOnly: true,
            patch: expect.objectContaining({
                status: "abandoned",
                metadata: expect.objectContaining({
                    stripe_checkout_session_create_failed_payment_type: "entry_fee",
                    stripe_checkout_session_create_failed_error: "stripe session create failed",
                }),
            }),
        });
    });
});
