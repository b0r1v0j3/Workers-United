import { redirect } from "next/navigation";
import { normalizeUserType } from "@/lib/domain";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAdminTestSession, getAdminTestWorkspaceHref } from "@/lib/admin-test-mode";

export const dynamic = "force-dynamic";

export default async function ProfileRedirector() {
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

    if (userType === "admin") {
        redirect("/admin");
    } else if (userType === "employer") {
        redirect("/profile/employer");
    } else if (userType === "agency") {
        redirect("/profile/agency");
    } else {
        redirect("/profile/worker");
    }
}
