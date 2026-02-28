"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { createBrowserClient } from "@supabase/ssr";
import NotificationBell from "./NotificationBell";
import GlobalSearch from "./admin/GlobalSearch";

interface UnifiedNavbarProps {
    variant: "public" | "dashboard" | "admin";
    user?: any; // Supabase user object
    profileName?: string; // Full name from profiles table (takes priority)
}

export default function UnifiedNavbar({ variant, user: userProp, profileName: profileNameProp }: UnifiedNavbarProps) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [clientUser, setClientUser] = useState<any>(userProp || null);
    const [clientProfileName, setClientProfileName] = useState(profileNameProp || "");
    const pathname = usePathname();

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
        <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md shadow-sm border-b border-[#dddfe2]/50 h-[64px]">
            <div className="max-w-[1920px] mx-auto px-4 h-full flex items-center justify-between">
                {/* Left: Logo */}
                <div className="flex items-center gap-3">
                    <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
                        <Image
                            src="/logo-icon.png"
                            alt="Workers United Logo"
                            width={80}
                            height={80}
                            className="h-16 w-16 object-contain shrink-0 transition-opacity"
                            priority
                        />
                        <Image
                            src="/logo-wordmark.png"
                            alt="Workers United"
                            width={200}
                            height={50}
                            className="w-[100px] sm:w-[140px] h-auto object-contain transition-opacity"
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

                {/* Center: Public Navigation (Desktop) */}
                {variant === "public" && (
                    <div className="hidden md:flex items-center gap-8 h-full">
                        <NavLink href="#how-it-works" label="How it works" />
                        <NavLink href="#workers" label="For Workers" />
                        <NavLink href="#employers" label="For Employers" />
                    </div>
                )}

                {/* Center: Admin Global Search */}
                {variant === "admin" && (
                    <GlobalSearch />
                )}

                {/* Right: Actions */}
                <div className="flex items-center gap-3">
                    {user ? (
                        <>
                            {variant === "public" && (
                                <Link
                                    href="/profile"
                                    className="hidden md:flex items-center gap-2 px-4 py-1.5 bg-[#F4F4F5] text-[#111111] rounded-md font-medium text-sm hover:bg-[#EAEAEA] transition-colors"
                                >
                                    My Profile
                                </Link>
                            )}

                            <div className="flex items-center gap-3 pl-3 border-l border-gray-200">
                                {/* Notifications */}
                                {variant !== "public" && <NotificationBell />}
                                {/* Profile/Logout */}
                                <span className="text-sm font-semibold text-[#050505] hidden sm:block">
                                    {profileName || user.user_metadata?.full_name || user.user_metadata?.first_name || user.email?.split('@')[0]}
                                </span>
                                <a
                                    href="/auth/signout"
                                    className="w-9 h-9 bg-[#f0f2f5] rounded-full flex items-center justify-center text-[#050505] hover:bg-[#e4e6eb] transition-colors"
                                    title="Logout"
                                >
                                    {/* Logout Icon */}
                                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                                        <path d="M16 13v-2H7V8l-5 4 5 4v-3z" />
                                        <path d="M20 3h-9c-1.103 0-2 .897-2 2v4h2V5h9v14h-9v-4H9v4c0 1.103.897 2 2 2h9c1.103 0 2-.897 2-2V5c0-1.103-.897-2-2-2z" />
                                    </svg>
                                </a>
                            </div>
                        </>
                    ) : (
                        <div className="hidden sm:flex items-center gap-2">
                            <Link
                                href="/login"
                                className="px-5 py-1.5 text-[#111111] font-medium text-sm hover:bg-[#F4F4F5] rounded-md transition-colors"
                            >
                                Sign In
                            </Link>
                            <Link
                                href="/signup"
                                className="px-5 py-1.5 bg-[#111111] text-white font-medium text-sm rounded-md shadow-sm hover:bg-[#333333] transition-colors"
                            >
                                Sign Up
                            </Link>
                        </div>
                    )}

                    {/* Mobile Menu Button (Public only) */}
                    {variant === "public" && (
                        <button
                            className="md:hidden p-2 text-[#050505]"
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {/* Mobile Menu Dropdown */}
            {isMenuOpen && variant === "public" && (
                <div className="md:hidden border-t border-[#dddfe2] bg-white absolute w-full left-0 shadow-lg py-2">
                    <MobileNavLink href="#how-it-works" label="How it works" onClick={() => setIsMenuOpen(false)} />
                    <MobileNavLink href="#workers" label="For Workers" onClick={() => setIsMenuOpen(false)} />
                    <MobileNavLink href="#employers" label="For Employers" onClick={() => setIsMenuOpen(false)} />
                    {!user && (
                        <>
                            <div className="border-t border-[#dddfe2] my-2" />
                            <MobileNavLink href="/login" label="Sign In" onClick={() => setIsMenuOpen(false)} />
                            <div className="px-4 py-3">
                                <Link
                                    href="/signup"
                                    onClick={() => setIsMenuOpen(false)}
                                    className="block text-center px-5 py-2.5 bg-[#111111] text-white font-medium text-[15px] rounded-md shadow-sm hover:bg-[#333333] transition-colors"
                                >
                                    Sign Up
                                </Link>
                            </div>
                        </>
                    )}
                </div>
            )}
        </nav>
    );
}

function NavLink({ href, label }: { href: string; label: string }) {
    return (
        <Link
            href={href}
            className="relative h-full flex items-center px-1 text-[#666666] font-medium text-[15px] hover:text-[#111111] transition-colors border-b-[2px] border-transparent hover:border-[#111111]"
        >
            {label}
        </Link>
    );
}

function MobileNavLink({ href, label, onClick }: { href: string; label: string; onClick: () => void }) {
    return (
        <Link
            href={href}
            onClick={onClick}
            className="block px-4 py-3 text-[#050505] font-medium hover:bg-[#f0f2f5]"
        >
            {label}
        </Link>
    );
}
