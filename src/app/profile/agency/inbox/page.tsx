import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminTestSession, getAdminTestWorkspaceHref } from "@/lib/admin-test-mode";
import { normalizeUserType } from "@/lib/domain";
import SupportInboxClient from "@/components/messaging/SupportInboxClient";

export const dynamic = "force-dynamic";

export default async function AgencyInboxPage() {
    const supabase = await createClient();
    const admin = createAdminClient();
    const session = await getAdminTestSession({ supabase, admin, ensurePersonas: true });
    const user = session.user;

    if (!user) {
        redirect("/login");
    }

    if (session.activePersona) {
        redirect(getAdminTestWorkspaceHref(session.activePersona.role));
    }

    const userType = normalizeUserType(session.liveUserType || user.user_metadata?.user_type);
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
