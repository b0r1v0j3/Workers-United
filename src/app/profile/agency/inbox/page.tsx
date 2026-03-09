import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { normalizeUserType } from "@/lib/domain";
import SupportInboxClient from "@/components/messaging/SupportInboxClient";

export const dynamic = "force-dynamic";

export default async function AgencyInboxPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    const userType = normalizeUserType(user.user_metadata?.user_type);
    if (userType === "worker") {
        redirect("/profile/worker");
    }

    if (userType === "employer") {
        redirect("/profile/employer");
    }

    if (userType !== "agency" && userType !== "admin") {
        redirect("/profile/agency");
    }

    return (
        <AppShell user={user} variant="dashboard">
            <SupportInboxClient audience="agency" readOnlyPreview={userType === "admin"} />
        </AppShell>
    );
}
