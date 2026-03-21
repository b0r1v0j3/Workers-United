import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendEmail } = vi.hoisted(() => ({
    sendEmail: vi.fn(),
}));

vi.mock("@/lib/mailer", () => ({
    sendEmail,
}));

import { attachEmailQueueMeta, processPendingEmailQueue, processQueuedEmailRecord } from "@/lib/email-queue";

function createEmailQueueSupabase(params?: {
    pendingRows?: Array<Record<string, unknown>>;
    updateErrorMessage?: string;
}) {
    const updates: Array<Record<string, unknown>> = [];
    const pendingRows = params?.pendingRows || [];

    return {
        updates,
        from(table: string) {
            if (table !== "email_queue") {
                throw new Error(`Unexpected table ${table}`);
            }

            return {
                update(payload: Record<string, unknown>) {
                    updates.push(payload);
                    return {
                        eq: vi.fn(async () => ({
                            error: params?.updateErrorMessage
                                ? { message: params.updateErrorMessage }
                                : null,
                        })),
                    };
                },
                select() {
                    return {
                        eq() {
                            return {
                                lte() {
                                    return {
                                        order() {
                                            return {
                                                limit: vi.fn(async () => ({
                                                    data: pendingRows,
                                                    error: null,
                                                })),
                                            };
                                        },
                                    };
                                },
                            };
                        },
                    };
                },
            };
        },
    };
}

describe("email queue retry processing", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("marks a queued email as sent when SMTP succeeds", async () => {
        sendEmail.mockResolvedValueOnce({ success: true });
        const supabase = createEmailQueueSupabase();

        const result = await processQueuedEmailRecord(supabase as never, {
            id: "email-1",
            recipient_email: "worker@example.com",
            subject: "Hello",
            template_data: attachEmailQueueMeta({ html: "<p>Hello</p>" }, { attempts: 0, maxAttempts: 3 }),
            scheduled_for: new Date().toISOString(),
        });

        expect(result).toMatchObject({
            id: "email-1",
            sent: true,
            queued: false,
            status: "sent",
            attempts: 1,
        });
        expect(sendEmail).toHaveBeenCalledWith("worker@example.com", "Hello", "<p>Hello</p>", undefined);
        expect(supabase.updates[0]).toMatchObject({
            status: "sent",
            error_message: null,
        });
    });

    it("re-queues retryable SMTP failures instead of marking them failed immediately", async () => {
        sendEmail.mockResolvedValueOnce({ success: false, error: "421 Temporary failure" });
        const supabase = createEmailQueueSupabase();

        const result = await processQueuedEmailRecord(supabase as never, {
            id: "email-2",
            recipient_email: "worker@example.com",
            subject: "Hello",
            template_data: attachEmailQueueMeta({ html: "<p>Hello</p>" }, { attempts: 0, maxAttempts: 3 }),
            scheduled_for: new Date().toISOString(),
        });

        expect(result.sent).toBe(false);
        expect(result.queued).toBe(true);
        expect(result.status).toBe("queued_retry");
        expect(result.retryScheduledFor).toBeTruthy();
        expect(supabase.updates[0]).toMatchObject({
            status: "pending",
            error_message: "421 Temporary failure",
        });
    });

    it("processes pending queue rows and reports retry counts", async () => {
        sendEmail
            .mockResolvedValueOnce({ success: true })
            .mockResolvedValueOnce({ success: false, error: "421 Temporary failure" });
        const supabase = createEmailQueueSupabase({
            pendingRows: [
                {
                    id: "email-1",
                    recipient_email: "sent@example.com",
                    subject: "Sent",
                    template_data: attachEmailQueueMeta({ html: "<p>Sent</p>" }, { attempts: 0, maxAttempts: 3 }),
                    scheduled_for: new Date().toISOString(),
                },
                {
                    id: "email-2",
                    recipient_email: "retry@example.com",
                    subject: "Retry",
                    template_data: attachEmailQueueMeta({ html: "<p>Retry</p>" }, { attempts: 0, maxAttempts: 3 }),
                    scheduled_for: new Date().toISOString(),
                },
            ],
        });

        const summary = await processPendingEmailQueue(supabase as never, 100);

        expect(summary).toEqual({
            processed: 2,
            sent: 1,
            retried: 1,
            failed: 0,
        });
    });

    it("throws when the sent-state persistence update fails", async () => {
        sendEmail.mockResolvedValueOnce({ success: true });
        const supabase = createEmailQueueSupabase({
            updateErrorMessage: "row update rejected",
        });

        await expect(processQueuedEmailRecord(supabase as never, {
            id: "email-3",
            recipient_email: "worker@example.com",
            subject: "Hello",
            template_data: attachEmailQueueMeta({ html: "<p>Hello</p>" }, { attempts: 0, maxAttempts: 3 }),
            scheduled_for: new Date().toISOString(),
        })).rejects.toThrow("Failed to mark email as sent: row update rejected");
    });
});
