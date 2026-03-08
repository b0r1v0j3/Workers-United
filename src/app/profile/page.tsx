import { redirect } from "next/navigation";
import { normalizeUserType } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ProfileRedirector() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    const userType = normalizeUserType(user.user_metadata?.user_type);

    if (userType === "admin") {
        redirect("/admin");
    } else if (userType === "employer") {
        redirect("/profile/employer");
    } else if (userType === "agency") {
        redirect("/profile/agency");
    } else {
        redirect("/profile/worker");
    }
}
