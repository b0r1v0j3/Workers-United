import { describe, expect, it } from "vitest";
import { buildStripeCheckoutPaymentMetadata, buildStripeCustomerMetadata } from "@/lib/stripe-checkout";

describe("stripe checkout helpers", () => {
    it("builds stable customer metadata for worker checkout identity", () => {
        expect(buildStripeCustomerMetadata({
            paymentType: "entry_fee",
            requesterRole: "worker",
            workerCountry: "Bangladesh",
            paymentOwnerProfileId: "profile-123",
            targetWorkerId: null,
            isAgencyPayingForWorker: false,
        })).toEqual({
            workers_united_profile_id: "profile-123",
            workers_united_worker_id: "",
            workers_united_payment_type: "entry_fee",
            workers_united_role: "worker",
            workers_united_worker_country: "Bangladesh",
            workers_united_agency_checkout: "",
        });
    });

    it("includes complete payment metadata for webhook correlation", () => {
        expect(buildStripeCheckoutPaymentMetadata({
            paymentId: "pay-1",
            userId: "user-1",
            paymentType: "entry_fee",
            offerId: "",
            paymentOwnerName: "Sanae Benyoussef",
            paymentOwnerEmail: "sanae@example.com",
            workerPhone: "+212656548490",
            workerCountry: "Morocco",
            paymentOwnerProfileId: "profile-1",
            targetWorkerId: "",
            paidByProfileId: "",
            requesterRole: "worker",
            isAgencyPayingForWorker: false,
        })).toEqual({
            payment_id: "pay-1",
            user_id: "user-1",
            payment_type: "entry_fee",
            offer_id: "",
            target_profile_id: "profile-1",
            target_worker_id: "",
            paid_by_profile_id: "",
            agency_checkout: "",
            worker_name: "Sanae Benyoussef",
            worker_email: "sanae@example.com",
            worker_phone: "+212656548490",
            worker_country: "Morocco",
        });
    });
});
