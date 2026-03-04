import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import WorkerLayoutClient from "./WorkerLayoutClient";

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
    const userType = user.user_metadata?.user_type;
    if (userType === 'employer') {
        redirect("/profile/employer");
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    const displayName = profile?.full_name || user.user_metadata?.full_name || "Worker";

    return (
        <WorkerLayoutClient user={user} displayName={displayName}>
            {children}
        </WorkerLayoutClient>
    );
}
