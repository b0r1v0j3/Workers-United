import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isGodModeUser } from "@/lib/godmode";
import UnifiedNavbar from "@/components/UnifiedNavbar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    const isOwner = isGodModeUser(user.email);

    if (profile?.role !== 'admin' && !isOwner) {
        redirect("/dashboard");
    }

    return (
        <div className="min-h-screen bg-[var(--bg)] font-montserrat">
            <UnifiedNavbar variant="admin" user={user} />
            {children}
        </div>
    );
}
