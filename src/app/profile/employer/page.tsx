import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EmployerProfileClient from "./EmployerProfileClient";

export const dynamic = "force-dynamic";

export default async function EmployerProfilePage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const userType = user.user_metadata?.user_type;
    if (userType !== "employer") {
        redirect("/profile/worker");
    }

    return <EmployerProfileClient />;
}
