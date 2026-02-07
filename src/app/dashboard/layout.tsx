import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import UnifiedNavbar from "@/components/UnifiedNavbar";

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

    return (
        <div className="min-h-screen bg-[var(--bg)] font-montserrat">
            <UnifiedNavbar variant="dashboard" user={user} />
            {children}
        </div>
    );
}
