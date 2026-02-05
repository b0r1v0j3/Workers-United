import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProfileClient from "./ProfileClient";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const userType = user.user_metadata?.user_type || "candidate";

    // Workers go to their old dashboard
    if (userType !== "employer") {
        redirect("/dashboard");
    }

    // Employers stay on profile
    const { data: employer } = await supabase
        .from("employers")
        .select("*")
        .eq("profile_id", user.id)
        .single();

    return <ProfileClient userType="employer" user={user} employer={employer} />;
}
