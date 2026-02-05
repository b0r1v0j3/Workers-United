import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isGodModeUser } from "@/lib/godmode";
import ProfileClient from "./ProfileClient";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const userType = user.user_metadata?.user_type || "candidate";
    const isOwner = isGodModeUser(user.email);

    // Regular workers go to dashboard (unless God Mode user)
    if (userType !== "employer" && !isOwner) {
        redirect("/dashboard");
    }

    // For employers OR god mode users viewing profile
    if (userType === "employer") {
        const { data: employer } = await supabase
            .from("employers")
            .select("*")
            .eq("profile_id", user.id)
            .single();

        return <ProfileClient userType="employer" user={user} employer={employer} />;
    }

    // God mode user viewing as candidate
    const { data: candidate } = await supabase
        .from("candidates")
        .select("*, profiles(*)")
        .eq("profile_id", user.id)
        .single();

    const { data: documents } = await supabase
        .from("candidate_documents")
        .select("*")
        .eq("user_id", user.id);

    const { data: offers } = await supabase
        .from("offers")
        .select("*, employers(*)")
        .eq("candidate_id", candidate?.id)
        .order("created_at", { ascending: false });

    return (
        <ProfileClient
            userType="candidate"
            user={user}
            candidate={candidate}
            documents={documents || []}
            offers={offers || []}
        />
    );
}
