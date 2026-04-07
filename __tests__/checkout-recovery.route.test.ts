import { describe, expect, it, vi } from "vitest";

import { tryMarkPendingEntryFeePaymentAbandoned } from "@/app/api/cron/checkout-recovery/route";

function createAdminClientForAbandonUpdate(result: { data?: { id?: string | null } | null; error?: { message: string } | null }) {
    const maybeSingle = vi.fn().mockResolvedValue(result);
    const select = vi.fn(() => ({ maybeSingle }));
    const eqStatus = vi.fn(() => ({ select }));
    const eqPaymentType = vi.fn(() => ({ eq: eqStatus }));
    const eqId = vi.fn(() => ({ eq: eqPaymentType }));
    const update = vi.fn(() => ({ eq: eqId }));
    const from = vi.fn(() => ({ update }));

    return {
        client: { from },
        spies: {
            from,
            update,
            eqId,
            eqPaymentType,
            eqStatus,
            select,
            maybeSingle,
        },
    };
}

describe("checkout-recovery abandonment helper", () => {
    it("returns abandoned=false when the pending payment update matches no row", async () => {
        const { client, spies } = createAdminClientForAbandonUpdate({
            data: null,
            error: null,
        });

        const result = await tryMarkPendingEntryFeePaymentAbandoned(
            client as never,
            "payment-1",
            "2026-03-21T12:00:00.000Z"
        );

        expect(result).toEqual({
            abandoned: false,
            error: "Pending entry-fee payment was not updated.",
        });
        expect(spies.from).toHaveBeenCalledWith("payments");
        expect(spies.eqId).toHaveBeenCalledWith("id", "payment-1");
        expect(spies.eqPaymentType).toHaveBeenCalledWith("payment_type", "entry_fee");
        expect(spies.eqStatus).toHaveBeenCalledWith("status", "pending");
    });

    it("returns abandoned=true only when the pending payment update persists a row", async () => {
        const { client } = createAdminClientForAbandonUpdate({
            data: { id: "payment-1" },
            error: null,
        });

        const result = await tryMarkPendingEntryFeePaymentAbandoned(
            client as never,
            "payment-1",
            "2026-03-21T12:00:00.000Z"
        );

        expect(result).toEqual({
            abandoned: true,
            error: null,
        });
    });

    it("persists metadata patch when marking a pending payment abandoned", async () => {
        const { client, spies } = createAdminClientForAbandonUpdate({
            data: { id: "payment-1" },
            error: null,
        });

        await tryMarkPendingEntryFeePaymentAbandoned(
            client as never,
            "payment-1",
            "2026-03-21T12:00:00.000Z",
            {
                checkout_entry_source: "worker_queue",
                latest_funnel_stage: "checkout_abandoned",
            }
        );

        expect(spies.update).toHaveBeenCalledWith({
            status: "abandoned",
            deadline_at: "2026-03-21T12:00:00.000Z",
            metadata: {
                checkout_entry_source: "worker_queue",
                latest_funnel_stage: "checkout_abandoned",
            },
        });
    });
});
