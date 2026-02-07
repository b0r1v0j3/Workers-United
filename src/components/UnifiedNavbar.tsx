"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";

interface UnifiedNavbarProps {
    variant: "public" | "dashboard" | "admin";
    user?: any; // Supabase user object
    profileName?: string; // Full name from profiles table (takes priority)
}

export default function UnifiedNavbar({ variant, user, profileName }: UnifiedNavbarProps) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const pathname = usePathname();

    return (
        <nav className="bg-white shadow-sm sticky top-0 z-50 border-b border-[#dddfe2] h-[56px]">
            <div className="max-w-[1920px] mx-auto px-4 h-full flex items-center justify-between">
                {/* Left: Logo */}
                <div className="flex items-center gap-3">
                    <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
                        <img
                            src="/logo.png"
                            alt="Workers United"
                            className="h-[60px] w-auto object-contain"
                        />
                        <span className="font-bold text-[#1877f2] text-xl hidden sm:inline tracking-tight">
                            Workers United
                        </span>
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

                {/* Right: Actions */}
                <div className="flex items-center gap-3">
                    {user ? (
                        <>
                            {variant === "public" && (
                                <Link
                                    href="/profile"
                                    className="hidden md:flex items-center gap-2 px-4 py-1.5 bg-[#e7f3ff] text-[#1877f2] rounded-md font-semibold text-sm hover:bg-[#dbe7f2] transition-colors"
                                >
                                    My Profile
                                </Link>
                            )}

                            <div className="flex items-center gap-3 pl-3 border-l border-gray-200">
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
                        <div className="flex items-center gap-2">
                            <Link
                                href="/login"
                                className="px-5 py-1.5 text-[#1877f2] font-semibold text-sm hover:bg-[#f0f2f5] rounded-md transition-colors"
                            >
                                Log In
                            </Link>
                            <Link
                                href="/signup"
                                className="px-5 py-1.5 bg-[#1877f2] text-white font-bold text-sm rounded-md shadow-sm hover:bg-[#166fe5] transition-colors"
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
                </div>
            )}
        </nav>
    );
}

function NavLink({ href, label }: { href: string; label: string }) {
    return (
        <Link
            href={href}
            className="relative h-full flex items-center px-1 text-[#65676b] font-semibold text-[15px] hover:text-[#1877f2] transition-colors border-b-[3px] border-transparent hover:border-[#1877f2]"
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
