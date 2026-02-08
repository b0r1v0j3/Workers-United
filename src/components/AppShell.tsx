"use client";

import Link from "next/link";
import UnifiedNavbar from "./UnifiedNavbar";

interface AppShellProps {
    children: React.ReactNode;
    user: any;
    variant?: "public" | "dashboard" | "admin";
}

export default function AppShell({ children, user, variant = "dashboard" }: AppShellProps) {
    const userType = user?.user_metadata?.user_type;

    // Determine navigation links based on variant
    const homeHref = variant === 'admin' ? '/admin'
        : userType === 'employer' ? '/profile/employer'
            : '/profile/worker';

    const profileHref = userType === 'employer' ? '/profile/employer' : '/profile/worker';

    return (
        <div className="min-h-screen bg-[#f0f2f5] flex flex-col font-montserrat">
            {/* Fixed Navbar */}
            <UnifiedNavbar variant={variant} user={user} />

            <div className="flex-1 flex max-w-[1920px] mx-auto w-full pt-4">
                {/* LEFT SIDEBAR (Desktop) */}
                <aside className="hidden lg:block w-[280px] fixed top-[56px] left-0 bottom-0 overflow-y-auto px-3 pb-4 pt-2">
                    <SidebarContent user={user} variant={variant} />
                </aside>

                {/* MAIN CONTENT — pb-20 for mobile bottom nav clearance */}
                <main className="flex-1 lg:ml-[280px] px-2 sm:px-4 max-w-[900px] mx-auto w-full pb-20 lg:pb-0">
                    {children}
                </main>
            </div>

            {/* MOBILE BOTTOM NAV — visible only on mobile */}
            <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#dddfe2] z-50 safe-area-bottom">
                <div className="flex items-center justify-around h-14">
                    {variant === 'admin' ? (
                        <>
                            <BottomNavLink href="/admin" icon="🏠" label="Home" />
                            <BottomNavLink href="/admin/candidates" icon="👤" label="Candidates" />
                            <BottomNavLink href="/admin/queue" icon="📋" label="Queue" />
                            <BottomNavLink href="/admin/settings" icon="⚙️" label="Settings" />
                        </>
                    ) : (
                        <>
                            <BottomNavLink href={homeHref} icon="🏠" label="Home" />
                            <BottomNavLink href={profileHref} icon="👤" label="Profile" />
                            {userType === 'employer' && (
                                <BottomNavLink href="/profile/employer/jobs" icon="💼" label="Jobs" />
                            )}
                            <BottomNavLink href="/profile/settings" icon="⚙️" label="Settings" />
                        </>
                    )}
                </div>
            </nav>
        </div>
    );
}

function SidebarContent({ user, variant }: { user: any, variant: string }) {
    const userType = user?.user_metadata?.user_type;

    // Determine Home link based on context
    const homeHref = variant === 'admin' ? '/admin'
        : userType === 'employer' ? '/profile/employer'
            : '/profile/worker';

    return (
        <div className="space-y-2">
            <SidebarLink href={homeHref} icon="🏠" label="Home" />

            {/* Only show profile link outside admin mode */}
            {variant !== 'admin' && (
                <SidebarLink
                    href={userType === 'employer' ? '/profile/employer' : '/profile/worker'}
                    icon={<img src={user?.user_metadata?.avatar_url || "/logo.png"} className="w-7 h-7 rounded-full object-cover" />}
                    label={user?.user_metadata?.full_name || "My Profile"}
                />
            )}

            <hr className="border-gray-300 my-2 mx-2" />

            <div className="px-2 text-lg font-semibold text-gray-500 mb-2 mt-4">Shortcuts</div>

            {variant === 'admin' && (
                <>
                    <SidebarLink href="/admin/candidates" icon="👤" label="Candidates" />
                    <SidebarLink href="/admin/employers" icon="🏢" label="Employers" />
                    <SidebarLink href="/admin/jobs" icon="💼" label="Jobs" />
                    <SidebarLink href="/admin/queue" icon="📋" label="Queue" />
                    <SidebarLink href="/admin/refunds" icon="💸" label="Refunds" />
                    <SidebarLink href="/admin/settings" icon="⚙️" label="Settings" />
                </>
            )}

            {/* Employer shortcuts only outside admin mode */}
            {variant !== 'admin' && userType === 'employer' && (
                <>
                    <SidebarLink href="/profile/employer/jobs" icon="💼" label="Job Postings" />
                </>
            )}

            {/* Account settings for all non-admin users */}
            {variant !== 'admin' && (
                <>
                    <hr className="border-gray-300 my-2 mx-2" />
                    <SidebarLink href="/profile/settings" icon="⚙️" label="Account Settings" />
                </>
            )}
        </div>
    );
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

function BottomNavLink({ href, icon, label }: { href: string; icon: string; label: string }) {
    return (
        <Link href={href} className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 text-[#65676b] hover:text-[#1877f2] transition-colors">
            <span className="text-xl">{icon}</span>
            <span className="text-[10px] font-semibold">{label}</span>
        </Link>
    );
}
