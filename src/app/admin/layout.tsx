import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isGodModeUser } from "@/lib/godmode";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
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

    const isOwner = isGodModeUser(user.email);

    if (profile?.user_type !== 'admin' && !isOwner) {
        redirect("/profile");
    }

    return <>{children}</>;
}
