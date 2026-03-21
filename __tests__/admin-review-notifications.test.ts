import { describe, expect, it } from "vitest";
import { getAdminReviewNotificationToast } from "@/lib/admin-review-notifications";

describe("admin-review-notifications", () => {
    it("returns a success toast for sent notifications", () => {
        expect(getAdminReviewNotificationToast("approve", { status: "sent" })).toEqual({
            variant: "success",
            message: "Document approved. Email sent to user.",
        });
    });

    it("returns a warning toast for queued notifications instead of claiming no email was sent", () => {
        expect(getAdminReviewNotificationToast("reject", {
            status: "queued",
            error: "421 temporary failure",
        })).toEqual({
            variant: "warning",
            message: "Rejected with feedback. Email queued for retry: 421 temporary failure",
        });
    });

    it("returns a warning toast for failed notifications", () => {
        expect(getAdminReviewNotificationToast("reject", {
            status: "failed",
            error: "smtp_failed",
        })).toEqual({
            variant: "warning",
            message: "Rejected with feedback. Email failed: smtp_failed",
        });
    });

    it("keeps skipped notifications on the no-email-sent branch", () => {
        expect(getAdminReviewNotificationToast("approve", { status: "skipped" })).toEqual({
            variant: "success",
            message: "Document approved. No email was sent.",
        });
    });
});
