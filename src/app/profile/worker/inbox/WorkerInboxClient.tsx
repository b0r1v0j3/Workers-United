"use client";

import SupportInboxClient from "@/components/messaging/SupportInboxClient";

export default function WorkerInboxClient({ readOnlyPreview = false }: { readOnlyPreview?: boolean }) {
    return <SupportInboxClient audience="worker" readOnlyPreview={readOnlyPreview} />;
}
