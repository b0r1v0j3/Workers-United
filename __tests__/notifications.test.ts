import { beforeEach, describe, expect, it, vi } from "vitest";

const { queueEmailMock } = vi.hoisted(() => ({
    queueEmailMock: vi.fn(),
}));

vi.mock("@/lib/email-templates", () => ({
    queueEmail: queueEmailMock,
}));

import { sendOfferExpiredNotification, sendOfferNotification } from "@/lib/notifications";

describe("notifications", () => {
    beforeEach(() => {
        queueEmailMock.mockReset();
        queueEmailMock.mockResolvedValue({ id: "email_1", sent: true, error: null });
    });

    it("queues job_offer through the unified email pipeline", async () => {
        const supabase = {} as never;

        await sendOfferNotification({
            supabase,
            workerUserId: "worker-profile-id",
            workerEmail: "worker@example.com",
            workerName: "Marko Petrovic",
            workerPhone: "+381601234567",
            jobTitle: "Welder",
            companyName: "Steel Works",
            country: "Germany",
            expiresAt: "2026-03-20T10:00:00.000Z",
            offerId: "offer-123",
        });

        expect(queueEmailMock).toHaveBeenCalledTimes(1);
        expect(queueEmailMock).toHaveBeenCalledWith(
            supabase,
            "worker-profile-id",
            "job_offer",
            "worker@example.com",
            "Marko Petrovic",
            expect.objectContaining({
                jobTitle: "Welder",
                companyName: "Steel Works",
                country: "Germany",
                expiresAt: "2026-03-20T10:00:00.000Z",
                offerLink: expect.stringContaining("/profile/worker/offers/offer-123"),
            }),
            undefined,
            "+381601234567",
        );
    });

    it("queues offer_expired through the unified email pipeline", async () => {
        const supabase = {} as never;

        await sendOfferExpiredNotification({
            supabase,
            workerUserId: "worker-profile-id",
            workerEmail: "worker@example.com",
            workerName: "Marko Petrovic",
            jobTitle: "Welder",
            queuePosition: 4,
        });

        expect(queueEmailMock).toHaveBeenCalledTimes(1);
        expect(queueEmailMock).toHaveBeenCalledWith(
            supabase,
            "worker-profile-id",
            "offer_expired",
            "worker@example.com",
            "Marko Petrovic",
            {
                jobTitle: "Welder",
                queuePosition: 4,
            },
        );
    });

    it("warns when the unified email pipeline reports a failed offer send", async () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        const supabase = {} as never;
        queueEmailMock.mockResolvedValueOnce({ id: "email_2", sent: false, error: "smtp_failed" });

        await sendOfferNotification({
            supabase,
            workerUserId: "worker-profile-id",
            workerEmail: "worker@example.com",
            workerName: "Marko Petrovic",
            workerPhone: "+381601234567",
            jobTitle: "Welder",
            companyName: "Steel Works",
            country: "Germany",
            expiresAt: "2026-03-20T10:00:00.000Z",
            offerId: "offer-123",
        });

        expect(warnSpy).toHaveBeenCalledWith(
            "[Notifications] Offer notification queue/send failed:",
            expect.objectContaining({
                workerUserId: "worker-profile-id",
                workerEmail: "worker@example.com",
                offerId: "offer-123",
                error: "smtp_failed",
            })
        );

        warnSpy.mockRestore();
    });
});
