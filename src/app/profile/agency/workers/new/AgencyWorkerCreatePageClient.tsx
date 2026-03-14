"use client";

import { useRouter } from "next/navigation";
import AgencyWorkerCreateModal from "../../AgencyWorkerCreateModal";

interface AgencyWorkerCreatePageClientProps {
    readOnlyPreview: boolean;
    inspectProfileId?: string | null;
}

export default function AgencyWorkerCreatePageClient({
    readOnlyPreview,
    inspectProfileId = null,
}: AgencyWorkerCreatePageClientProps) {
    const router = useRouter();
    const dashboardHref = inspectProfileId ? `/profile/agency?inspect=${inspectProfileId}` : "/profile/agency";

    return (
        <AgencyWorkerCreateModal
            open
            standalone
            readOnlyPreview={readOnlyPreview}
            inspectProfileId={inspectProfileId}
            onClose={() => router.replace(dashboardHref)}
            onLiveSave={() => router.replace(dashboardHref)}
        />
    );
}
