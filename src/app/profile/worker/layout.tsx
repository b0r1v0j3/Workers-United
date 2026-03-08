import { redirect } from "next/navigation";
import { normalizeUserType } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function WorkerLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    // Redirect employers to employer profile
    const userType = normalizeUserType(user.user_metadata?.user_type);
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
