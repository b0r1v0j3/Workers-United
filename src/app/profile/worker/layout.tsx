import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function WorkerProfileLayout({ children }: { children: React.ReactNode }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    // Redirect employers to employer profile
    if (user.user_metadata?.user_type === 'employer') {
        redirect("/profile/employer");
    }

    return <>{children}</>;
}
