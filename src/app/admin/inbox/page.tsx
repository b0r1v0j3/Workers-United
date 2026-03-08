import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import AdminInboxClient from "./AdminInboxClient";

export const dynamic = "force-dynamic";

export default async function AdminInboxPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    return (
        <AppShell user={user} variant="admin">
            <AdminInboxClient />
        </AppShell>
    );
}
