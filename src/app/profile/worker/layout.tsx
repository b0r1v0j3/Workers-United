import { redirect } from "next/navigation";
import { normalizeUserType } from "@/lib/domain";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { buildAdminTestUser, getAdminTestSession, getAdminTestWorkspaceHref } from "@/lib/admin-test-mode";
import AppShell from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function WorkerLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();
    const admin = createAdminClient();
    const session = await getAdminTestSession({ supabase, admin, ensurePersonas: true });
    const user = session.user;

    if (!user) {
        redirect("/login");
    }

    if (session.activePersona) {
        if (session.activePersona.role !== "worker") {
            redirect(getAdminTestWorkspaceHref(session.activePersona.role));
        }

        return (
            <AppShell
                user={buildAdminTestUser(user, {
                    persona: session.activePersona,
                    displayName: session.activePersona.label,
                    email: session.ownerProfile?.email || user.email,
                })}
                variant="dashboard"
                adminTestMode={{
                    active: true,
                    role: "worker",
                    label: session.activePersona.label,
                }}
            >
                {children}
            </AppShell>
        );
    }

    // Redirect employers to employer profile
    const userType = normalizeUserType(session.liveUserType || user.user_metadata?.user_type);
    if (userType === 'employer') {
        redirect("/profile/employer");
    }
    if (userType === "agency") {
        redirect("/profile/agency");
    }

    return (
        <AppShell user={user} variant="dashboard">
            {children}
        </AppShell>
    );
}
