import { describe, expect, it } from "vitest";
import { buildWhatsAppQualitySnapshot } from "@/lib/whatsapp-quality";

describe("buildWhatsAppQualitySnapshot", () => {
    it("captures reply delivery failures and retryable failures separately", () => {
        const snapshot = buildWhatsAppQualitySnapshot([
            {
                action: "whatsapp_reply_delivery_failed",
                created_at: "2026-03-20T09:00:00.000Z",
                user_id: "worker-1",
                details: {
                    phone: "+381600000001",
                    failure_category: "platform",
                    retryable: true,
                    reply_preview: "Retry this later",
                },
            },
            {
                action: "whatsapp_reply_delivery_failed",
                created_at: "2026-03-20T08:00:00.000Z",
                user_id: null,
                details: {
                    phone: "+381600000002",
                    failure_category: "recipient",
                    retryable: false,
                    reply_preview: "24h window closed",
                },
            },
        ]);

        expect(snapshot.replyDeliveryFailures).toBe(2);
        expect(snapshot.retryableReplyFailures).toBe(1);
        expect(snapshot.recentReplyDeliveryFailures).toEqual([
            expect.objectContaining({
                phone: "+381600000001",
                failureCategory: "platform",
                retryable: true,
                profileId: "worker-1",
            }),
            expect.objectContaining({
                phone: "+381600000002",
                failureCategory: "recipient",
                retryable: false,
                profileId: null,
            }),
        ]);
    });
});
