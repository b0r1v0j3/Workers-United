import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import EmailPreviewWorkspace from "@/components/admin/EmailPreviewWorkspace";
import { createClient } from "@/lib/supabase/server";
import { isGodModeUser } from "@/lib/godmode";
import { normalizeUserType } from "@/lib/domain";

export default async function AdminEmailPreviewPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .single();

    const profileType = normalizeUserType(profile?.user_type);
    const metadataType = normalizeUserType(user.user_metadata?.user_type);
    if (profileType !== "admin" && metadataType !== "admin" && !isGodModeUser(user.email)) {
        redirect("/profile");
    }

    return (
        <AppShell user={user} variant="admin">
            <EmailPreviewWorkspace />
        </AppShell>
    );
}
