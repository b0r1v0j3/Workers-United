"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Image from "next/image";
import { createBrowserClient } from "@supabase/ssr";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import NotificationBell from "./NotificationBell";
import GlobalSearch from "./admin/GlobalSearch";

interface UnifiedNavbarProps {
    variant: "public" | "dashboard" | "admin";
    user?: SupabaseUser | null;
    profileName?: string; // Full name from profiles table (takes priority)
}

export default function UnifiedNavbar({ variant, user: userProp, profileName: profileNameProp }: UnifiedNavbarProps) {
    const [clientUser, setClientUser] = useState<SupabaseUser | null>(userProp || null);
    const [clientProfileName, setClientProfileName] = useState(profileNameProp || "");

    // Client-side auth fetch for public variant (allows homepage to be statically cached)
    useEffect(() => {
        if (userProp || variant !== "public") return; // skip if user already provided or not public
        const supabase = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        supabase.auth.getUser().then(({ data }) => {
            if (data.user) {
                setClientUser(data.user);
                supabase
                    .from("profiles")
                    .select("full_name")
                    .eq("id", data.user.id)
                    .single()
                    .then(({ data: profile }) => {
                        setClientProfileName(profile?.full_name || "");
                    });
            }
        });
    }, [userProp, variant]);

    const user = userProp || clientUser;
    const profileName = profileNameProp || clientProfileName;

    return (
        <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md shadow-sm border-b border-[#dddfe2]/50 h-[68px]">
            <div className="max-w-[1920px] mx-auto px-4 h-full flex items-center justify-between">
                {/* Left: Logo */}
                <div className="flex items-center gap-3">
                    <Link href="/" className="flex items-center gap-2.5 md:gap-3 hover:opacity-90 transition-opacity py-1">
                        <Image
                            src="/logo-icon.png"
                            alt="Workers United Logo Icon"
                            width={48}
                            height={48}
                            className="h-9 w-9 md:h-10 md:w-10 object-contain shrink-0 transition-opacity"
                            priority
                        />
                        <Image
                            src="/logo-wordmark.png"
                            alt="Workers United"
                            width={859}
                            height={63}
                            className="h-auto w-[132px] md:w-[158px] object-contain shrink-0 transition-opacity"
                            priority
                        />
                    </Link>

                    {/* Context Badge (Admin/Employer) */}
                    {variant === "admin" && (
                        <span className="bg-red-100 text-red-700 text-[11px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                            Admin
                        </span>
                    )}
                </div>

                {/* Center: Admin Global Search */}
                {variant === "admin" && (
                    <GlobalSearch />
                )}

                {/* Right: Actions */}
                <div className="flex items-center gap-3">
                    {variant === "public" ? (
                        user ? (
                            <div className="flex items-center gap-2 md:gap-3">
                                <Link
                                    href="/profile"
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#F4F4F5] text-[#111111] rounded-md font-medium text-sm hover:bg-[#EAEAEA] transition-colors"
                                >
                                    My Profile
                                </Link>
                                <span className="text-sm font-semibold text-[#050505] hidden lg:block">
                                    {profileName || user.user_metadata?.full_name || user.user_metadata?.first_name || user.email?.split('@')[0]}
                                </span>
                            </div>
                        ) : (
                            <Link
                                href="/login"
                                className="inline-flex items-center px-4 md:px-5 py-2 text-[#111111] font-medium text-sm hover:bg-[#F4F4F5] rounded-md transition-colors"
                            >
                                Sign in
                            </Link>
                        )
                    ) : (
                        user && (
                            <div className="flex items-center gap-3 pl-3 border-l border-gray-200">
                                <NotificationBell />
                                <span className="text-sm font-semibold text-[#050505] hidden sm:block">
                                    {profileName || user.user_metadata?.full_name || user.user_metadata?.first_name || user.email?.split('@')[0]}
                                </span>
                            </div>
                        )
                    )}
                </div>
            </div>
        </nav>
    );
}
