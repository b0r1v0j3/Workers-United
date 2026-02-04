"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function SignOutPage() {
    const router = useRouter();

    useEffect(() => {
        const signOut = async () => {
            const supabase = createClient();
            await supabase.auth.signOut();

            // Clear any cookies
            document.cookie = "admin_role=; path=/; max-age=0";

            // Redirect to home
            router.push("/");
        };

        signOut();
    }, [router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#f4f6fb]">
            <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2f6fed] mx-auto mb-4"></div>
                <p className="text-[#6c7a89]">Signing out...</p>
            </div>
        </div>
    );
}
