
"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import UnifiedNavbar from "./UnifiedNavbar";

interface AppShellProps {
    children: React.ReactNode;
    user: any; // Supabase user
    variant?: "public" | "dashboard" | "admin"; // Reusing existing variant types
}

export default function AppShell({ children, user, variant = "dashboard" }: AppShellProps) {
    // We can reuse UnifiedNavbar, or build a custom shell navbar. 
    // UnifiedNavbar already handles logic well, so we wrap it.

    return (
        <div className="min-h-screen bg-[#f0f2f5] flex flex-col font-montserrat">
            {/* Fixed Navbar */}
            <UnifiedNavbar variant={variant} user={user} />

            <div className="flex-1 flex max-w-[1920px] mx-auto w-full pt-4">
                {/* LEFT SIDEBAR (Desktop) */}
                <aside className="hidden lg:block w-[280px] fixed top-[56px] left-0 bottom-0 overflow-y-auto px-3 pb-4 pt-2">
                    <SidebarContent user={user} variant={variant} />
                </aside>

                {/* MAIN CONTENT (Feed/Profile) */}
                <main className="flex-1 lg:ml-[280px] xl:mr-[280px] px-2 sm:px-4 max-w-[800px] mx-auto w-full">
                    {children}
                </main>

                {/* RIGHT SIDEBAR (Desktop) */}
                <aside className="hidden xl:block w-[280px] fixed top-[56px] right-0 bottom-0 overflow-y-auto px-3 pb-4 pt-2">
                    <RightbarContent user={user} variant={variant} />
                </aside>
            </div>
        </div>
    );
}

function SidebarContent({ user, variant }: { user: any, variant: string }) {
    // Navigation / Shortcuts
    const userType = user?.user_metadata?.user_type || "worker";

    return (
        <div className="space-y-2">
            <SidebarLink href={userType === 'employer' ? "/profile/employer" : "/profile/worker"} icon="🏠" label="Home" />
            <SidebarLink
                href={userType === 'employer' ? '/profile/employer' : '/profile/worker'}
                icon={<img src={user?.user_metadata?.avatar_url || "/logo.png"} className="w-7 h-7 rounded-full object-cover" />}
                label={user?.user_metadata?.full_name || "My Profile"}
            />
            <hr className="border-gray-300 my-2 mx-2" />

            <div className="px-2 text-lg font-semibold text-gray-500 mb-2 mt-4">Shortcuts</div>
            {userType === 'worker' && (
                <>
                    <SidebarLink href="/profile" icon="📄" label="My Applications" />
                    <SidebarLink href="/documents" icon="📁" label="Documents" />
                </>
            )}
            {userType === 'employer' && (
                <>
                    <SidebarLink href="/profile/employer/jobs" icon="💼" label="Job Postings" />
                    <SidebarLink href="/employer/candidates" icon="👥" label="Candidates" />
                </>
            )}
            {variant === 'admin' && (
                <>
                    <SidebarLink href="/admin/candidates" icon="👥" label="Candidates" />
                    <SidebarLink href="/admin/employers" icon="🏢" label="Employers" />
                    <SidebarLink href="/admin/jobs" icon="💼" label="Jobs" />
                </>
            )}

            <SidebarLink href="/settings" icon="⚙️" label="Settings" />
        </div>
    );
}

function RightbarContent({ user, variant }: { user: any, variant: string }) {
    // Sponsored / Contacts / Birthdays
    return (
        <div className="space-y-6">
            {/* Section 1: Sponsored (Placeholder) */}
            <div>
                <h3 className="text-gray-500 font-semibold mb-3 px-2">Sponsored</h3>
                <a href="#" className="flex items-center gap-3 p-2 hover:bg-gray-200 rounded-lg transition-colors group">
                    <div className="w-[120px] h-[120px] bg-gray-300 rounded-lg overflow-hidden relative">
                        {/* Placeholder Ad Image */}
                        <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-xs">Ad</div>
                    </div>
                    <div className="flex-1">
                        <div className="font-semibold text-gray-900 group-hover:underline">Legal Visa Support</div>
                        <div className="text-xs text-gray-500">workersunited.eu</div>
                    </div>
                </a>
            </div>

            <hr className="border-gray-300 mx-2" />

            {/* Section 2: Contacts/Status */}
            <div>
                <div className="flex items-center justify-between px-2 mb-2">
                    <h3 className="text-gray-500 font-semibold">Contacts</h3>
                    <button className="text-gray-500 hover:bg-gray-200 p-1 rounded-full">🔎</button>
                </div>
                {/* Mock Contacts */}
                <ContactRow name="Workers United Support" status="online" />
            </div>
        </div>
    )
}

function SidebarLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
    return (
        <Link href={href} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-200 transition-colors group">
            <div className="w-9 h-9 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                {icon}
            </div>
            <span className="font-medium text-[#050505] text-[15px]">{label}</span>
        </Link>
    );
}

function ContactRow({ name, status }: { name: string, status: "online" | "offline" }) {
    return (
        <div className="flex items-center gap-3 p-2 hover:bg-gray-200 rounded-lg cursor-pointer">
            <div className="relative">
                <div className="w-9 h-9 bg-gray-300 rounded-full flex items-center justify-center overflow-hidden">
                    <img src="/logo.png" alt="Contact" className="w-full h-full object-cover" />
                </div>
                {status === 'online' && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#f0f2f5]"></div>
                )}
            </div>
            <span className="font-medium text-[14px] text-[#050505]">{name}</span>
        </div>
    )
}
