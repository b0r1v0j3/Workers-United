import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    // Redirect employers to employer dashboard
    if (user.user_metadata?.user_type === 'employer') {
        redirect("/employer/dashboard");
    }

    // AppShell inside DashboardClient handles the navbar + sidebars
    return <>{children}</>;
}
