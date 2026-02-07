import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ProfileRedirector() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    const userType = user.user_metadata?.user_type;

    if (userType === "admin") {
        redirect("/admin");
    } else if (userType === "employer") {
        redirect("/profile/employer");
    } else {
        redirect("/profile/worker");
    }
}
