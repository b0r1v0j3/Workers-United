import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import UnifiedNavbar from "@/components/UnifiedNavbar";
import WorkerSidebar from "./WorkerSidebar";

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
        <div className="min-h-screen bg-[#FAFAFA] text-gray-900 flex flex-col">
            <UnifiedNavbar variant="dashboard" user={user} profileName={displayName} />
            <div className="max-w-5xl mx-auto w-full px-4 py-8 flex-1">
                <div className="flex flex-col md:flex-row gap-6">
                    <WorkerSidebar />
                    <div className="flex-1 min-w-0">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}
