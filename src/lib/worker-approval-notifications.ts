import type { TemplateData } from "@/lib/email-templates";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://workersunited.eu";

export function buildWorkerPaymentUnlockedEmailData(): TemplateData {
    return {
        subject: "Job Finder Is Now Unlocked",
        title: "Profile Approved",
        message: "Your profile has been approved by our team. Job Finder checkout is now unlocked in your dashboard, so you can activate the $9 service whenever you are ready.",
        actionText: "Open Job Finder",
        actionLink: `${BASE_URL}/profile/worker`,
    };
}
