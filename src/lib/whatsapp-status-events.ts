export interface WhatsAppStatusEvent {
    id?: string | null;
    status?: string | null;
    errors?: Array<{
        code?: string | number | null;
        title?: string | null;
    }> | null;
}

type WhatsAppStatusAdminClient = {
    from: (table: string) => {
        update: (payload: Record<string, string>) => {
            eq: (column: string, value: string) => Promise<unknown> | unknown;
        };
    };
};

export function buildWhatsAppStatusUpdateData(statusEvent: WhatsAppStatusEvent): Record<string, string> | null {
    const wamid = typeof statusEvent.id === "string" ? statusEvent.id.trim() : "";
    const statusValue = typeof statusEvent.status === "string" ? statusEvent.status.trim() : "";

    if (!wamid || !statusValue) {
        return null;
    }

    const updateData: Record<string, string> = { status: statusValue };
    const primaryError = statusEvent.errors?.[0];

    if (statusValue === "failed" && primaryError) {
        const errorCode = primaryError.code != null ? String(primaryError.code).trim() : "";
        const errorTitle = primaryError.title?.trim() || "";

        if (errorCode && errorTitle) {
            updateData.error_message = `${errorCode}: ${errorTitle}`;
        } else if (errorTitle) {
            updateData.error_message = errorTitle;
        } else if (errorCode) {
            updateData.error_message = errorCode;
        }
    }

    return updateData;
}

export async function persistWhatsAppDeliveryStatuses(
    admin: WhatsAppStatusAdminClient,
    statusEvents: WhatsAppStatusEvent[] | null | undefined
) {
    if (!statusEvents || statusEvents.length === 0) {
        return 0;
    }

    let persistedCount = 0;

    for (const statusEvent of statusEvents) {
        const updateData = buildWhatsAppStatusUpdateData(statusEvent);
        const wamid = typeof statusEvent.id === "string" ? statusEvent.id.trim() : "";

        if (!updateData || !wamid) {
            continue;
        }

        await admin
            .from("whatsapp_messages")
            .update(updateData)
            .eq("wamid", wamid);

        persistedCount += 1;
    }

    return persistedCount;
}
