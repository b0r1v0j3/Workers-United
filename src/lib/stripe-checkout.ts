import Stripe from "stripe";
import { normalizeWorkerPhone } from "@/lib/workers";

export interface StripeCheckoutCustomerIdentity {
    paymentType: string;
    requesterRole?: string | null;
    paymentOwnerName?: string | null;
    paymentOwnerEmail?: string | null;
    workerPhone?: string | null;
    workerCountry?: string | null;
    paymentOwnerProfileId?: string | null;
    targetWorkerId?: string | null;
    isAgencyPayingForWorker?: boolean;
}

export interface StripeCheckoutPaymentMetadataInput extends StripeCheckoutCustomerIdentity {
    paymentId: string;
    userId: string;
    offerId?: string | null;
    paidByProfileId?: string | null;
}

function trimToNull(value: string | null | undefined): string | null {
    if (typeof value !== "string") {
        return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function toStripeMetadataValue(value: string | null | undefined): string {
    return trimToNull(value) || "";
}

function isDeletedCustomer(customer: Stripe.Customer | Stripe.DeletedCustomer): customer is Stripe.DeletedCustomer {
    return "deleted" in customer && customer.deleted === true;
}

function matchesCustomerIdentity(
    customer: Stripe.Customer | Stripe.DeletedCustomer,
    identity: StripeCheckoutCustomerIdentity
): customer is Stripe.Customer {
    if (isDeletedCustomer(customer)) {
        return false;
    }

    const profileId = trimToNull(identity.paymentOwnerProfileId);
    const workerId = trimToNull(identity.targetWorkerId);

    if (profileId && customer.metadata?.workers_united_profile_id === profileId) {
        return true;
    }

    if (workerId && customer.metadata?.workers_united_worker_id === workerId) {
        return true;
    }

    return false;
}

export function buildStripeCustomerMetadata(identity: StripeCheckoutCustomerIdentity): Record<string, string> {
    return {
        workers_united_profile_id: toStripeMetadataValue(identity.paymentOwnerProfileId),
        workers_united_worker_id: toStripeMetadataValue(identity.targetWorkerId),
        workers_united_payment_type: toStripeMetadataValue(identity.paymentType),
        workers_united_role: toStripeMetadataValue(identity.requesterRole),
        workers_united_worker_country: toStripeMetadataValue(identity.workerCountry),
        workers_united_agency_checkout: identity.isAgencyPayingForWorker ? "true" : "",
    };
}

export function buildStripeCheckoutPaymentMetadata(
    input: StripeCheckoutPaymentMetadataInput
): Record<string, string> {
    return {
        payment_id: input.paymentId,
        user_id: input.userId,
        payment_type: input.paymentType,
        offer_id: toStripeMetadataValue(input.offerId),
        target_profile_id: toStripeMetadataValue(input.paymentOwnerProfileId),
        target_worker_id: toStripeMetadataValue(input.targetWorkerId),
        paid_by_profile_id: toStripeMetadataValue(input.paidByProfileId),
        agency_checkout: input.isAgencyPayingForWorker ? "true" : "",
        worker_name: toStripeMetadataValue(input.paymentOwnerName),
        worker_email: toStripeMetadataValue(input.paymentOwnerEmail),
        worker_phone: toStripeMetadataValue(normalizeWorkerPhone(input.workerPhone)),
        worker_country: toStripeMetadataValue(input.workerCountry),
    };
}

export async function ensureStripeCheckoutCustomer(
    stripe: Stripe,
    identity: StripeCheckoutCustomerIdentity
): Promise<string | null> {
    const name = trimToNull(identity.paymentOwnerName);
    const email = trimToNull(identity.paymentOwnerEmail);
    const phone = normalizeWorkerPhone(identity.workerPhone);

    if (!name && !email && !phone) {
        return null;
    }

    const metadata = buildStripeCustomerMetadata(identity);

    let customer: Stripe.Customer | null = null;

    if (email) {
        const existingCustomers = await stripe.customers.list({
            email,
            limit: 20,
        });

        customer = existingCustomers.data.find((entry) => matchesCustomerIdentity(entry, identity))
            || existingCustomers.data.find((entry) => !isDeletedCustomer(entry) && !entry.metadata?.workers_united_profile_id)
            || existingCustomers.data.find((entry) => !isDeletedCustomer(entry))
            || null;
    }

    if (!customer) {
        const createdCustomer = await stripe.customers.create({
            name: name || undefined,
            email: email || undefined,
            phone: phone || undefined,
            metadata,
        });

        return createdCustomer.id;
    }

    const nextMetadata = {
        ...customer.metadata,
        ...metadata,
    };

    const needsMetadataUpdate = Object.entries(nextMetadata).some(([key, value]) => customer.metadata?.[key] !== value);

    if (
        (name && customer.name !== name)
        || (email && customer.email !== email)
        || (phone && customer.phone !== phone)
        || needsMetadataUpdate
    ) {
        await stripe.customers.update(customer.id, {
            name: name || customer.name || undefined,
            email: email || customer.email || undefined,
            phone: phone || customer.phone || undefined,
            metadata: nextMetadata,
        });
    }

    return customer.id;
}
