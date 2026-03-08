import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { normalizeUserType } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";
import AccountSettingsClient from "./AccountSettingsClient";

export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    const userType = normalizeUserType(user.user_metadata?.user_type);
    if (userType === "admin") {
        redirect("/admin");
    }

    return (
        <AppShell user={user} variant="dashboard">
            <AccountSettingsClient />
        </AppShell>
    );
}
