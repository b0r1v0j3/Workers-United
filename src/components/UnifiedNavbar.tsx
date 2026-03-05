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
    const [isScrolled, setIsScrolled] = useState(false);

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
    const isPublic = variant === "public";

    useEffect(() => {
        if (!isPublic) return;
        const onScroll = () => setIsScrolled(window.scrollY > 8);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, [isPublic]);

    return (
        <nav
            className={`sticky top-0 z-50 backdrop-blur-md ${
                isPublic
                    ? `${isScrolled ? "bg-white/70 backdrop-blur-sm" : "bg-white/40 backdrop-blur-[2px]"} h-[52px] md:h-[56px]`
                    : "bg-white/90 shadow-sm border-b border-[#dddfe2]/50 h-[68px]"
            }`}
        >
            <div className="w-full px-3 md:px-8 lg:px-10 h-full flex items-center justify-between relative">
                {/* Left: Logo */}
                <div className="z-10 flex items-center gap-3">
                    <Link href="/" className="flex items-center gap-2.5 md:gap-3 hover:opacity-90 transition-opacity py-1">
                        {isPublic ? (
                            <Image
                                src="/logo-wordmark.png"
                                alt="Workers United"
                                width={859}
                                height={63}
                                className="h-auto w-[122px] object-contain shrink-0 transition-opacity md:w-[168px]"
                                priority
                            />
                        ) : (
                            <Image
                                src="/logo-icon.png"
                                alt="Workers United Logo Icon"
                                width={80}
                                height={80}
                                className="h-14 w-14 md:h-16 md:w-16 object-contain shrink-0 transition-opacity"
                                priority
                            />
                        )}
                        {!isPublic && (
                            <Image
                                src="/logo-wordmark.png"
                                alt="Workers United"
                                width={859}
                                height={63}
                                className="h-auto w-[132px] md:w-[158px] object-contain shrink-0 transition-opacity"
                                priority
                            />
                        )}
                    </Link>

                    {/* Context Badge (Admin/Employer) */}
                    {variant === "admin" && (
                        <span className="bg-red-100 text-red-700 text-[11px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                            Admin
                        </span>
                    )}
                </div>

                {/* Center: Public logo icon */}
                {isPublic && (
                    <Link
                        href="/"
                        className="absolute left-1/2 -translate-x-1/2 hover:opacity-90 transition-opacity"
                    >
                        <Image
                            src="/logo-icon.png"
                            alt="Workers United Logo"
                            width={112}
                            height={112}
                            className="h-12 w-12 object-contain md:h-14 md:w-14"
                            priority
                        />
                    </Link>
                )}

                {/* Center: Admin Global Search */}
                {variant === "admin" && (
                    <GlobalSearch />
                )}

                {/* Right: Actions */}
                <div className="flex items-center gap-2 md:gap-3 z-10">
                    {isPublic ? (
                        user ? (
                            <div className="flex items-center gap-2 md:gap-3">
                                <span className="text-sm font-semibold text-[#050505] hidden md:block">
                                    {profileName || user.user_metadata?.full_name || user.user_metadata?.first_name || user.email?.split('@')[0]}
                                </span>
                                <Link
                                    href="/profile"
                                    className="inline-flex items-center px-3 md:px-4 py-1.5 bg-[#F4F4F5]/80 text-[#111111] rounded-md font-medium text-sm hover:bg-[#EAEAEA] transition-colors"
                                >
                                    Profile
                                </Link>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1 md:gap-2">
                                <Link
                                    href="/login"
                                    className="inline-flex items-center px-3 md:px-4 py-1.5 text-[#111111] font-medium text-sm hover:bg-[#F4F4F5]/80 rounded-md transition-colors"
                                >
                                    Log in
                                </Link>
                                <Link
                                    href="/signup"
                                    className="inline-flex items-center px-3 md:px-4 py-1.5 text-[#111111] font-medium text-sm hover:bg-[#F4F4F5]/80 rounded-md transition-colors"
                                >
                                    Sign up
                                </Link>
                            </div>
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
