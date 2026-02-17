"use client";

import {
    LayoutDashboard,
    Users,
    Building2,
    Settings,
    Mail,
    Briefcase,
    Home,
    User,
    LogOut
} from "lucide-react";
import Link from "next/link";
import UnifiedNavbar from "./UnifiedNavbar";
import { usePathname } from "next/navigation";

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
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-montserrat">
            {/* Fixed Navbar */}
            <UnifiedNavbar variant={variant} user={user} />

            <div className="flex-1 flex max-w-[1920px] mx-auto w-full pt-6">
                {/* LEFT SIDEBAR (Desktop) - Enhanced aesthetics */}
                <aside className="hidden lg:block w-[280px] fixed top-[80px] left-0 bottom-0 overflow-y-auto px-4 pb-4">
                    <div className="bg-white/50 backdrop-blur-sm border border-white/60 shadow-sm rounded-2xl h-[calc(100vh-100px)] p-4">
                        <SidebarContent user={user} variant={variant} />
                    </div>
                </aside>

                {/* MAIN CONTENT — pb-20 for mobile bottom nav clearance */}
                <main className="flex-1 lg:ml-[280px] px-3 sm:px-6 max-w-[1000px] mx-auto w-full pb-24 lg:pb-10 animate-fade-in-up">
                    {children}
                </main>
            </div>

            {/* MOBILE BOTTOM NAV — visible only on mobile */}
            <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-slate-200 z-50 safe-area-bottom shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
                <div className="flex items-center justify-around h-16">
                    {variant === 'admin' ? (
                        <>
                            <BottomNavLink href="/admin" icon={<LayoutDashboard size={22} />} label="Home" />
                            <BottomNavLink href="/admin/workers" icon={<Users size={22} />} label="Workers" />
                            <BottomNavLink href="/admin/employers" icon={<Building2 size={22} />} label="Employers" />
                            <BottomNavLink href="/admin/email-preview" icon={<Mail size={22} />} label="Emails" />
                            <BottomNavLink href="/admin/settings" icon={<Settings size={22} />} label="Settings" />
                        </>
                    ) : (
                        <>
                            <BottomNavLink href={homeHref} icon={<Home size={22} />} label="Home" />
                            <BottomNavLink href={profileHref} icon={<User size={22} />} label="Profile" />
                            {userType === 'employer' && (
                                <BottomNavLink href="/profile/employer/jobs" icon={<Briefcase size={22} />} label="Jobs" />
                            )}
                            <BottomNavLink href="/profile/settings" icon={<Settings size={22} />} label="Settings" />
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
        <div className="space-y-1.5">
            <SidebarLink href={homeHref} icon={<LayoutDashboard size={20} />} label="Dashboard" />

            {/* Only show profile link outside admin mode */}
            {variant !== 'admin' && (
                <SidebarLink
                    href={userType === 'employer' ? '/profile/employer' : '/profile/worker'}
                    icon={<img src={user?.user_metadata?.avatar_url || "/logo.png"} className="w-6 h-6 rounded-full object-cover ring-2 ring-white shadow-sm" />}
                    label={user?.user_metadata?.full_name || "My Profile"}
                />
            )}

            <hr className="border-slate-100 my-4 mx-2" />

            <div className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Menu</div>

            {variant === 'admin' && (
                <>
                    <SidebarLink href="/admin/workers" icon={<Users size={20} />} label="Workers" />
                    <SidebarLink href="/admin/employers" icon={<Building2 size={20} />} label="Employers" />
                    <SidebarLink href="/admin/email-preview" icon={<Mail size={20} />} label="Email Preview" />
                    <SidebarLink href="/admin/settings" icon={<Settings size={20} />} label="Settings" />
                </>
            )}

            {/* Employer shortcuts only outside admin mode */}
            {variant !== 'admin' && userType === 'employer' && (
                <>
                    <SidebarLink href="/profile/employer/jobs" icon={<Briefcase size={20} />} label="Job Postings" />
                </>
            )}

            {/* Account settings for all non-admin users */}
            {variant !== 'admin' && (
                <>
                    <hr className="border-slate-100 my-4 mx-2" />
                    <SidebarLink href="/profile/settings" icon={<Settings size={20} />} label="Account Settings" />
                </>
            )}
        </div>
    );
}

function SidebarLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
    const pathname = usePathname();
    const isActive = pathname === href || (href !== '/admin' && href !== '/profile/employer' && href !== '/profile/worker' && pathname.startsWith(href));

    return (
        <Link
            href={href}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 group relative overflow-hidden ${isActive
                    ? "bg-blue-50 text-blue-700 shadow-sm"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
        >
            {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 bg-blue-500 rounded-r-md" />
            )}
            <div className={`w-6 h-6 flex items-center justify-center transition-colors ${isActive ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"
                }`}>
                {icon}
            </div>
            <span className={`font-medium text-[14px] ${isActive ? "font-semibold" : ""}`}>{label}</span>
        </Link>
    );
}

function BottomNavLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
    const pathname = usePathname();
    const isActive = pathname === href;

    return (
        <Link href={href} className={`flex flex-col items-center justify-center gap-1 px-2 py-1 transition-colors w-full h-full relative ${isActive ? "text-blue-600" : "text-slate-400 hover:text-slate-600"
            }`}>
            {isActive && (
                <span className="absolute top-0 w-8 h-[2px] bg-blue-600 rounded-b-md shadow-sm shadow-blue-200"></span>
            )}
            <div className={`transition-transform duration-200 ${isActive ? "-translate-y-0.5" : ""}`}>
                {icon}
            </div>
            <span className="text-[10px] font-semibold tracking-tight">{label}</span>
        </Link>
    );
}
