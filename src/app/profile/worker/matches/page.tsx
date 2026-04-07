import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import MatchInboxClient from "@/components/messaging/MatchInboxClient";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminTestSession, getAdminTestWorkspaceHref } from "@/lib/admin-test-mode";
import { normalizeUserType } from "@/lib/domain";

export const dynamic = "force-dynamic";

export default async function WorkerMatchInboxPage() {
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

    if (userType === "employer") {
        redirect("/profile/employer");
    }

    if (userType === "agency") {
        redirect("/profile/agency");
    }

    if (userType !== "worker" && userType !== "admin") {
        redirect("/profile/worker");
    }

    return (
        <AppShell user={user} variant="dashboard">
            <MatchInboxClient audience="worker" readOnlyPreview={userType === "admin"} />
        </AppShell>
    );
}

