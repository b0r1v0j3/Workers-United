import { describe, expect, it } from "vitest";
import { classifyEntryFeePaymentQuality, readPaymentQualityMarketSignals } from "@/lib/payment-quality";

describe("payment quality helpers", () => {
    it("classifies issuer declines from charge telemetry", () => {
        expect(classifyEntryFeePaymentQuality({
            status: "pending",
            hoursSinceCheckout: 4,
            metadata: {
                stripe_failure_code: "card_declined",
                stripe_decline_code: "do_not_honor",
                stripe_network_status: "declined_by_network",
            },
        })).toMatchObject({
            outcome: "issuer_declined",
            label: "Bank declined",
        });
    });

    it("classifies Stripe risk blocks before issuer authorization", () => {
        expect(classifyEntryFeePaymentQuality({
            status: "pending",
            hoursSinceCheckout: 1,
            metadata: {
                stripe_outcome_type: "blocked",
                stripe_outcome_reason: "highest_risk_level",
                stripe_risk_level: "highest",
            },
        })).toMatchObject({
            outcome: "stripe_blocked",
            label: "Stripe blocked",
        });
    });

    it("classifies expired sessions from webhook metadata", () => {
        expect(classifyEntryFeePaymentQuality({
            status: "pending",
            hoursSinceCheckout: 90,
            metadata: {
                stripe_session_status: "expired",
                stripe_session_expired_at: "2026-03-18T10:00:00.000Z",
            },
        })).toMatchObject({
            outcome: "expired",
            label: "Checkout expired",
        });
    });

    it("treats old unpaid pending rows as abandoned checkout", () => {
        expect(classifyEntryFeePaymentQuality({
            status: "pending",
            hoursSinceCheckout: 73,
            metadata: {},
        })).toMatchObject({
            outcome: "abandoned",
            label: "Abandoned checkout",
        });
    });

    it("keeps fresh pending checkout rows in the active bucket", () => {
        expect(classifyEntryFeePaymentQuality({
            status: "pending",
            hoursSinceCheckout: 12,
            metadata: {},
        })).toMatchObject({
            outcome: "active",
            label: "Active checkout",
        });
    });

    it("reads worker and billing market signals from payment metadata", () => {
        expect(readPaymentQualityMarketSignals({
            worker_country: "Morocco",
            stripe_billing_country: "MA",
            stripe_card_country: "MA",
        })).toEqual({
            workerCountry: "Morocco",
            billingCountry: "MA",
            cardCountry: "MA",
        });
    });
});
