import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { normalizeUserType } from "@/lib/domain";
import WorkerInboxClient from "./WorkerInboxClient";

export const dynamic = "force-dynamic";

export default async function WorkerInboxPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    const userType = normalizeUserType(user.user_metadata?.user_type);
    if (userType === "employer") {
        redirect("/profile/employer");
    }

    if (userType === "agency") {
        redirect("/profile/agency");
    }

    return (
        <AppShell user={user} variant="dashboard">
            <WorkerInboxClient readOnlyPreview={userType === "admin"} />
        </AppShell>
    );
}
