import { describe, expect, it, vi, beforeEach } from "vitest";
import {
    activateEntryFeeWorkerAfterPayment,
    buildStripeCheckoutExpiredActivityPayload,
    buildStripePaymentCompletedActivityPayload,
    buildStripePaymentFailedActivityPayload,
    getStripePaymentAmounts,
    mergeStripePaymentMetadata,
    persistCompletedStripeCheckoutPayment,
    queueEntryFeePaymentSuccessEmail,
    updateStripePaymentRecordByReference,
} from "@/lib/stripe-payment-finalization";

const { loadCanonicalWorkerRecord, queueEmail } = vi.hoisted(() => ({
    loadCanonicalWorkerRecord: vi.fn(),
    queueEmail: vi.fn(),
}));

vi.mock("@/lib/workers", () => ({
    loadCanonicalWorkerRecord,
}));

vi.mock("@/lib/email-templates", () => ({
    queueEmail,
}));

describe("stripe-payment-finalization", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns canonical Stripe amounts for entry and confirmation fees", () => {
        expect(getStripePaymentAmounts("entry_fee")).toEqual({
            amount: 9,
            amountCents: 900,
        });

        expect(getStripePaymentAmounts("confirmation_fee")).toEqual({
            amount: 190,
            amountCents: 19000,
        });
    });

    it("builds canonical payment failed activity payloads", () => {
        expect(
            buildStripePaymentFailedActivityPayload({
                paymentType: "entry_fee",
                paymentId: "payment-1",
                stripePaymentIntentId: "pi_1",
                stripeChargeId: "ch_1",
                targetWorkerId: "worker-1",
                failureCode: "card_declined",
                declineCode: "do_not_honor",
                outcomeReason: "highest_risk_level",
                networkStatus: "not_sent_to_network",
                riskLevel: "highest",
                error: "Issuer declined",
                source: "confirm-session-route",
            })
        ).toEqual({
            type: "entry_fee",
            payment_id: "payment-1",
            stripe_payment_intent_id: "pi_1",
            stripe_charge_id: "ch_1",
            target_worker_id: "worker-1",
            failure_code: "card_declined",
            decline_code: "do_not_honor",
            outcome_reason: "highest_risk_level",
            network_status: "not_sent_to_network",
            risk_level: "highest",
            error: "Issuer declined",
            source: "confirm-session-route",
        });
    });

    it("builds canonical payment completed and expired activity payloads", () => {
        expect(
            buildStripePaymentCompletedActivityPayload({
                paymentType: "confirmation_fee",
                amount: 190,
                paidByProfileId: "profile-1",
                offerId: "offer-1",
                source: "confirm-session-route",
                stripeSessionId: "cs_1",
            })
        ).toEqual({
            type: "confirmation_fee",
            amount: 190,
            paid_by_profile_id: "profile-1",
            offer_id: "offer-1",
            source: "confirm-session-route",
            stripe_session_id: "cs_1",
        });

        expect(
            buildStripeCheckoutExpiredActivityPayload({
                paymentType: "entry_fee",
                paymentId: "payment-2",
                stripeSessionId: "cs_2",
                targetWorkerId: "worker-2",
            })
        ).toEqual({
            type: "entry_fee",
            payment_id: "payment-2",
            stripe_session_id: "cs_2",
            target_worker_id: "worker-2",
        });
    });

    it("merges Stripe payment metadata without dropping existing keys", () => {
        expect(
            mergeStripePaymentMetadata(
                { existing: "keep", overwritten: "old" },
                { overwritten: "new", added: "value" }
            )
        ).toEqual({
            existing: "keep",
            overwritten: "new",
            added: "value",
        });
    });

    it("updates failure metadata by reference and preserves existing metadata", async () => {
        const maybeSingle = vi.fn().mockResolvedValue({
            data: {
                id: "payment-row-1",
                metadata: {
                    original: "keep",
                },
            },
            error: null,
        });
        const updateEq = vi.fn().mockResolvedValue({ error: null });
        const update = vi.fn().mockReturnValue({ eq: updateEq });

        const admin = {
            from: (table: string) => {
                if (table !== "payments") {
                    throw new Error(`Unexpected table: ${table}`);
                }

                return {
                    select: () => ({
                        eq: () => ({
                            maybeSingle,
                        }),
                    }),
                    update,
                };
            },
        };

        await updateStripePaymentRecordByReference({
            admin: admin as never,
            paymentId: "payment-row-1",
            patch: {
                metadata: {
                    stripe_failure_code: "card_declined",
                },
            },
        });

        expect(update).toHaveBeenCalledWith({
            metadata: {
                original: "keep",
                stripe_failure_code: "card_declined",
            },
        });
        expect(updateEq).toHaveBeenCalledWith("id", "payment-row-1");
    });

    it("honors pendingOnly when updating checkout-session-linked payment rows", async () => {
        const maybeSingle = vi.fn().mockResolvedValue({
            data: {
                id: "payment-row-2",
                metadata: null,
            },
            error: null,
        });
        const updateEqStatus = vi.fn().mockResolvedValue({ error: null });
        const updateEqId = vi.fn().mockReturnValue({ eq: updateEqStatus });
        const update = vi.fn().mockReturnValue({ eq: updateEqId });

        const admin = {
            from: (table: string) => {
                if (table !== "payments") {
                    throw new Error(`Unexpected table: ${table}`);
                }

                return {
                    select: () => ({
                        eq: () => ({
                            maybeSingle,
                        }),
                    }),
                    update,
                };
            },
        };

        await updateStripePaymentRecordByReference({
            admin: admin as never,
            stripeSessionId: "cs_test_456",
            pendingOnly: true,
            patch: {
                metadata: {
                    stripe_session_expired_at: "2026-03-19T07:00:00.000Z",
                },
            },
        });

        expect(updateEqId).toHaveBeenCalledWith("id", "payment-row-2");
        expect(updateEqStatus).toHaveBeenCalledWith("status", "pending");
    });

    it("persists completed checkout metadata through the shared payment upsert helper", async () => {
        const paymentUpdateEq = vi.fn().mockResolvedValue({ error: null });
        const paymentUpdate = vi.fn().mockReturnValue({ eq: paymentUpdateEq });

        const admin = {
            from: (table: string) => {
                if (table !== "payments") {
                    throw new Error(`Unexpected table: ${table}`);
                }

                return {
                    update: paymentUpdate,
                };
            },
        };

        await persistCompletedStripeCheckoutPayment({
            admin: admin as never,
            session: {
                id: "cs_test_123",
                metadata: { original: "yes" },
                payment_intent: "pi_123",
                currency: "usd",
                status: "complete",
                payment_status: "paid",
                customer_details: {
                    address: {
                        country: "MA",
                        postal_code: "10000",
                    },
                },
            } as never,
            paymentId: "payment-row-1",
            paymentType: "entry_fee",
            targetProfileId: "worker-profile-1",
            paidByProfileId: "worker-profile-1",
            metadataPatch: {
                confirmed_via: "confirm-session-route",
            },
        });

        expect(paymentUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                user_id: "worker-profile-1",
                profile_id: "worker-profile-1",
                payment_type: "entry_fee",
                amount: 9,
                amount_cents: 900,
                status: "completed",
                stripe_checkout_session_id: "cs_test_123",
                metadata: expect.objectContaining({
                    original: "yes",
                    stripe_payment_intent_id: "pi_123",
                    stripe_currency: "USD",
                    stripe_session_status: "complete",
                    stripe_payment_status: "paid",
                    stripe_customer_country: "MA",
                    stripe_customer_postal_code: "10000",
                    confirmed_via: "confirm-session-route",
                    paid_by_profile_id: "worker-profile-1",
                    target_worker_id: null,
                }),
            })
        );
        expect(paymentUpdateEq).toHaveBeenCalledWith("id", "payment-row-1");
    });

    it("activates direct worker payments without regressing post-entry-fee statuses", async () => {
        const workerUpdateEq = vi.fn().mockResolvedValue({ error: null });
        const workerUpdate = vi.fn().mockReturnValue({ eq: workerUpdateEq });

        loadCanonicalWorkerRecord.mockResolvedValue({
            data: {
                id: "worker-row-1",
                status: "OFFER_PENDING",
                queue_joined_at: "2026-03-01T10:00:00.000Z",
                entry_fee_paid: false,
                job_search_active: false,
            },
            error: null,
        });

        const admin = {
            from: (table: string) => {
                if (table !== "worker_onboarding") {
                    throw new Error(`Unexpected table: ${table}`);
                }

                return {
                    update: workerUpdate,
                };
            },
        };

        await activateEntryFeeWorkerAfterPayment({
            admin: admin as never,
            targetProfileId: "worker-profile-1",
            activatedAt: "2026-03-19T06:00:00.000Z",
        });

        expect(loadCanonicalWorkerRecord).toHaveBeenCalledWith(
            admin,
            "worker-profile-1",
            "id, status, queue_joined_at, entry_fee_paid, job_search_active"
        );
        expect(workerUpdate).toHaveBeenCalledWith({
            entry_fee_paid: true,
            job_search_active: true,
            job_search_activated_at: "2026-03-19T06:00:00.000Z",
        });
        expect(workerUpdateEq).toHaveBeenCalledWith("profile_id", "worker-profile-1");
    });

    it("activates agency-managed worker payments through the same shared helper", async () => {
        const maybeSingle = vi.fn().mockResolvedValue({
            data: {
                id: "agency-worker-1",
                status: "NEW",
                queue_joined_at: null,
            },
            error: null,
        });
        const agencyUpdateEq = vi.fn().mockResolvedValue({ error: null });
        const agencyUpdate = vi.fn().mockReturnValue({ eq: agencyUpdateEq });

        const admin = {
            from: (table: string) => {
                if (table !== "worker_onboarding") {
                    throw new Error(`Unexpected table: ${table}`);
                }

                return {
                    select: () => ({
                        eq: () => ({
                            maybeSingle,
                        }),
                    }),
                    update: agencyUpdate,
                };
            },
        };

        await activateEntryFeeWorkerAfterPayment({
            admin: admin as never,
            targetWorkerId: "agency-worker-1",
            activatedAt: "2026-03-19T06:00:00.000Z",
        });

        expect(agencyUpdate).toHaveBeenCalledWith({
            entry_fee_paid: true,
            job_search_active: true,
            job_search_activated_at: "2026-03-19T06:00:00.000Z",
            queue_joined_at: "2026-03-19T06:00:00.000Z",
            status: "IN_QUEUE",
        });
        expect(agencyUpdateEq).toHaveBeenCalledWith("id", "agency-worker-1");
    });

    it("queues payment success email only once through the shared helper", async () => {
        const existingEmailMaybeSingle = vi.fn().mockResolvedValue({
            data: null,
            error: null,
        });
        const profileMaybeSingle = vi.fn().mockResolvedValue({
            data: {
                full_name: "Worker One",
                email: "worker@example.com",
            },
            error: null,
        });

        loadCanonicalWorkerRecord.mockResolvedValue({
            data: {
                id: "worker-row-1",
                phone: "+123456789",
            },
            error: null,
        });

        const admin = {
            from: (table: string) => {
                if (table === "email_queue") {
                    return {
                        select: () => ({
                            eq: () => ({
                                eq: () => ({
                                    in: () => ({
                                        maybeSingle: existingEmailMaybeSingle,
                                    }),
                                }),
                            }),
                        }),
                    };
                }

                if (table === "profiles") {
                    return {
                        select: () => ({
                            eq: () => ({
                                maybeSingle: profileMaybeSingle,
                            }),
                        }),
                    };
                }

                throw new Error(`Unexpected table: ${table}`);
            },
        };

        const result = await queueEntryFeePaymentSuccessEmail({
            admin: admin as never,
            targetProfileId: "worker-profile-1",
            sessionCustomerEmail: "fallback@example.com",
        });

        expect(result).toEqual({
            status: "queued",
            recipientEmail: "worker@example.com",
        });
        expect(queueEmail).toHaveBeenCalledWith(
            admin,
            "worker-profile-1",
            "payment_success",
            "worker@example.com",
            "Worker One",
            { amount: "$9" },
            undefined,
            "+123456789"
        );
    });

    it("returns already_queued when payment success email already exists", async () => {
        const existingEmailMaybeSingle = vi.fn().mockResolvedValue({
            data: { id: "email-row-1" },
            error: null,
        });

        const admin = {
            from: (table: string) => {
                if (table !== "email_queue") {
                    throw new Error(`Unexpected table: ${table}`);
                }

                return {
                    select: () => ({
                        eq: () => ({
                            eq: () => ({
                                in: () => ({
                                    maybeSingle: existingEmailMaybeSingle,
                                }),
                            }),
                        }),
                    }),
                };
            },
        };

        const result = await queueEntryFeePaymentSuccessEmail({
            admin: admin as never,
            targetProfileId: "worker-profile-1",
            sessionCustomerEmail: "worker@example.com",
        });

        expect(result).toEqual({ status: "already_queued" });
        expect(queueEmail).not.toHaveBeenCalled();
    });
});
