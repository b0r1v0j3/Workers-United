export type AdminWorkerNotificationStatus = "sent" | "queued" | "failed" | "skipped";
export type AdminWorkerNotificationChannelStatus = "sent" | "failed" | "skipped";

export type AdminWorkerBannerTone = "emerald" | "blue" | "amber" | "rose";
export type AdminWorkerBannerIcon = "check" | "mail" | "alert" | "trash";

export type AdminWorkerBannerData = {
    tone: AdminWorkerBannerTone;
    title: string;
    copy: string;
    icon: AdminWorkerBannerIcon;
};

type DeliveryResultLike = {
    sent?: boolean;
    queued?: boolean;
    error?: string | null;
    whatsapp?: {
        attempted?: boolean;
        sent?: boolean;
        error?: string | null;
    } | null;
} | null | undefined;

export function buildManualWorkerStatusEmailData(statusLabel: string) {
    const safeStatusLabel = statusLabel?.trim() || "Updated";

    return {
        title: "Status Update",
        subject: `Application Status Updated: ${safeStatusLabel}`,
        message: `Your application status has been updated to: ${safeStatusLabel}.`,
    };
}

export function resolveAdminWorkerNotificationStatus(result: DeliveryResultLike): {
    status: Exclude<AdminWorkerNotificationStatus, "skipped">;
    error: string | null;
    whatsappStatus: AdminWorkerNotificationChannelStatus;
    whatsappError: string | null;
} {
    const whatsappStatus = !result?.whatsapp?.attempted
        ? "skipped"
        : result.whatsapp.sent
            ? "sent"
            : "failed";
    const whatsappError = whatsappStatus === "failed"
        ? result?.whatsapp?.error || "WhatsApp send failed."
        : null;

    if (result?.sent) {
        return {
            status: "sent",
            error: null,
            whatsappStatus,
            whatsappError,
        };
    }

    if (result?.queued) {
        return {
            status: "queued",
            error: result.error || null,
            whatsappStatus,
            whatsappError,
        };
    }

    return {
        status: "failed",
        error: result?.error || "Email send failed.",
        whatsappStatus,
        whatsappError,
    };
}

export function getDocumentActionBannerData(
    action: string | undefined,
    error: string | undefined,
    notification: string | undefined
): AdminWorkerBannerData | null {
    if (error) {
        return {
            tone: "amber",
            title: "Document action needs attention",
            copy: error,
            icon: "alert",
        };
    }

    switch (action) {
        case "updated":
            if (notification === "failed") {
                return {
                    tone: "amber",
                    title: "Document decision saved, email failed",
                    copy: "The admin decision was saved, but the worker notification email failed to send. Check email health or resend from preview if needed.",
                    icon: "alert",
                };
            }
            if (notification === "skipped") {
                return {
                    tone: "blue",
                    title: "Document decision saved",
                    copy: "The admin decision was saved. No worker email was sent because this case does not currently have a direct-notification recipient.",
                    icon: "mail",
                };
            }
            if (notification === "queued") {
                return {
                    tone: "blue",
                    title: "Document decision saved, email queued",
                    copy: "The admin decision was saved and the worker notification email hit a retry path, so it is queued for automatic delivery.",
                    icon: "mail",
                };
            }
            return {
                tone: "emerald",
                title: "Document decision saved",
                copy: "The latest admin document decision was saved, the worker notification email was sent successfully, and the case view has been refreshed.",
                icon: "check",
            };
        case "requested":
            if (notification === "failed") {
                return {
                    tone: "amber",
                    title: "Worker re-upload requested, email failed",
                    copy: "The current file was removed, but the replacement-request email failed to send. Check email health or resend from preview if needed.",
                    icon: "alert",
                };
            }
            if (notification === "skipped") {
                return {
                    tone: "blue",
                    title: "Worker re-upload requested",
                    copy: "The current file was removed. No worker email was sent because this case does not currently have a direct-notification recipient.",
                    icon: "mail",
                };
            }
            if (notification === "queued") {
                return {
                    tone: "blue",
                    title: "Worker re-upload requested, email queued",
                    copy: "The current file was removed and the worker notification email hit a retry path, so it is queued with your replacement guidance.",
                    icon: "mail",
                };
            }
            return {
                tone: "emerald",
                title: "Worker re-upload requested",
                copy: "The current file was removed and the worker notification email was sent successfully with your replacement guidance.",
                icon: "check",
            };
        case "deleted":
            return {
                tone: "rose",
                title: "Document deleted",
                copy: "The current file and any stored crop backups were removed without notifying the worker.",
                icon: "trash",
            };
        default:
            return null;
    }
}

export function getApprovalActionBannerData(
    action: string | undefined,
    notification: string | undefined,
    error: string | undefined,
    whatsappStatus?: string | undefined,
): AdminWorkerBannerData | null {
    if (error) {
        return {
            tone: "amber",
            title: "Approval update needs attention",
            copy: error,
            icon: "alert",
        };
    }

    if (action === "approved") {
        if (notification === "failed") {
            return {
                tone: "amber",
                title: "Worker approved, email failed",
                copy: "Job Finder was unlocked for the worker, but the unlock email failed to send. Check email health or resend from preview if needed.",
                icon: "alert",
            };
        }

        if (notification === "skipped") {
            return {
                tone: "blue",
                title: "Worker approved",
                copy: "Job Finder is unlocked. No unlock email was sent because this case does not currently have a direct-notification recipient.",
                icon: "mail",
            };
        }

        if (notification === "queued") {
            if (whatsappStatus === "failed") {
                return {
                    tone: "amber",
                    title: "Worker approved, WhatsApp failed",
                    copy: "Job Finder is unlocked and the approval email is queued for automatic delivery, but the WhatsApp update failed. Check WhatsApp health if this worker depends on that channel.",
                    icon: "alert",
                };
            }
            return {
                tone: "blue",
                title: "Worker approved, email queued",
                copy: "Job Finder is unlocked. The approval email hit a retry path and is queued to be delivered automatically.",
                icon: "mail",
            };
        }

        if (whatsappStatus === "failed") {
            return {
                tone: "amber",
                title: "Worker approved, WhatsApp failed",
                copy: "Job Finder is unlocked and the approval email was sent successfully, but the WhatsApp update failed. Check WhatsApp health if this worker depends on that channel.",
                icon: "alert",
            };
        }

        return {
            tone: "emerald",
            title: "Worker approved",
            copy: "Job Finder is unlocked and the approval email was sent successfully.",
            icon: "check",
        };
    }

    if (action === "revoked") {
        return {
            tone: "rose",
            title: "Approval revoked",
            copy: "Admin approval was removed and the worker returned to the correct pre-payment review state.",
            icon: "alert",
        };
    }

    return null;
}

export function getStatusActionBannerData(
    action: string | undefined,
    notification: string | undefined,
    error: string | undefined,
    whatsappStatus?: string | undefined,
): AdminWorkerBannerData | null {
    if (error) {
        return {
            tone: "amber",
            title: "Worker status update needs attention",
            copy: error,
            icon: "alert",
        };
    }

    if (action !== "updated") {
        return null;
    }

    if (notification === "failed") {
        return {
            tone: "amber",
            title: "Worker status saved, email failed",
            copy: "The worker status was saved, but the notification email failed to send. Check email health or resend from preview if needed.",
            icon: "alert",
        };
    }

    if (notification === "skipped") {
        return {
            tone: "blue",
            title: "Worker status saved",
            copy: "The worker status was saved. No worker email was sent because this case does not currently have a direct-notification recipient.",
            icon: "mail",
        };
    }

    if (notification === "queued") {
        if (whatsappStatus === "failed") {
            return {
                tone: "amber",
                title: "Worker status saved, WhatsApp failed",
                copy: "The worker status was saved and the notification email is queued for automatic delivery, but the WhatsApp update failed. Check WhatsApp health if this worker depends on that channel.",
                icon: "alert",
            };
        }
        return {
            tone: "blue",
            title: "Worker status saved, email queued",
            copy: "The worker status was saved and the notification email hit a retry path, so it is queued for automatic delivery.",
            icon: "mail",
        };
    }

    if (whatsappStatus === "failed") {
        return {
            tone: "amber",
            title: "Worker status saved, WhatsApp failed",
            copy: "The worker status was saved and the notification email was sent successfully, but the WhatsApp update failed. Check WhatsApp health if this worker depends on that channel.",
            icon: "alert",
        };
    }

    return {
        tone: "emerald",
        title: "Worker status saved",
        copy: "The worker status was saved and the notification email was sent successfully.",
        icon: "check",
    };
}
