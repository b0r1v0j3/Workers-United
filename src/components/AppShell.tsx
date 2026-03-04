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
    LogOut,
    BarChart3,
    ListOrdered,
    FileSearch,
    ChevronRight,
    X,
} from "lucide-react";
import Link from "next/link";
import UnifiedNavbar from "./UnifiedNavbar";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

interface AppShellProps {
    children: React.ReactNode;
    user: any;
    variant?: "public" | "dashboard" | "admin";
}

export default function AppShell({ children, user, variant = "dashboard" }: AppShellProps) {
    const userType = user?.user_metadata?.user_type;
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const pathname = usePathname();

    // Close sidebar when route changes
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [pathname]);

    // Swipe to open/close logic
    useEffect(() => {
        let touchStartX = 0;
        let touchEndX = 0;

        const handleTouchStart = (e: TouchEvent) => {
            touchStartX = e.targetTouches[0].clientX;
        };

        const handleTouchEnd = (e: TouchEvent) => {
            touchEndX = e.changedTouches[0].clientX;
            // Swipe right from the left edge (open)
            if (touchStartX < 50 && touchEndX - touchStartX > 50) {
                setIsMobileMenuOpen(true);
            }
            // Swipe left (close)
            if (touchStartX > 50 && touchStartX - touchEndX > 50) {
                setIsMobileMenuOpen(false);
            }
        };

        document.addEventListener('touchstart', handleTouchStart);
        document.addEventListener('touchend', handleTouchEnd);

        return () => {
            document.removeEventListener('touchstart', handleTouchStart);
            document.removeEventListener('touchend', handleTouchEnd);
        };
    }, []);

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
                {/* Mobile Toggle Button (Floating on left edge) */}
                <button
                    onClick={() => setIsMobileMenuOpen(true)}
                    className={`lg:hidden fixed left-0 top-1/2 -translate-y-1/2 z-40 bg-white shadow-md border border-gray-200 px-1 py-4 rounded-r-xl transition-transform duration-300 ${isMobileMenuOpen ? '-translate-x-full' : 'translate-x-0'}`}
                    aria-label="Open Menu"
                >
                    <ChevronRight size={24} className="text-gray-500" />
                </button>

                {/* Mobile Backdrop */}
                {isMobileMenuOpen && (
                    <div
                        className="lg:hidden fixed inset-0 bg-black/40 z-40 backdrop-blur-sm transition-opacity delay-75"
                        onClick={() => setIsMobileMenuOpen(false)}
                    />
                )}

                {/* SIDEBAR (Desktop + Mobile Drawer) - Enhanced aesthetics */}
                <aside className={`
                    fixed inset-y-0 left-0 z-50 w-72 bg-[#F8FAFC] transform transition-transform duration-300 ease-in-out
                    lg:block lg:w-[280px] lg:fixed lg:top-[80px] lg:bottom-0 lg:overflow-y-auto lg:px-4 lg:pb-4 lg:bg-transparent lg:translate-x-0 lg:z-0
                    ${isMobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full shadow-none"}
                `}>
                    <div className="h-full overflow-y-auto p-4 lg:bg-white/50 lg:backdrop-blur-sm lg:border lg:border-white/60 lg:shadow-sm lg:rounded-2xl lg:h-[calc(100vh-100px)]">
                        {/* Mobile Header with Close Button */}
                        <div className="flex justify-between items-center mb-6 lg:hidden px-2 pt-4">
                            <h2 className="font-bold text-lg text-gray-900">Menu</h2>
                            <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 bg-gray-200 rounded-full text-gray-600">
                                <X size={20} />
                            </button>
                        </div>

                        <SidebarContent user={user} variant={variant} />
                    </div>
                </aside>

                {/* MAIN CONTENT */}
                <main className="flex-1 lg:ml-[280px] px-3 sm:px-6 max-w-[1000px] mx-auto w-full pb-10 animate-fade-in-up">
                    {variant === 'admin' && <AdminBreadcrumbs />}
                    {children}
                </main>
            </div>
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
                    <SidebarLink href="/admin/jobs" icon={<Briefcase size={20} />} label="Jobs" />
                    <SidebarLink href="/admin/queue" icon={<ListOrdered size={20} />} label="Queue" />
                    <SidebarLink href="/admin/review" icon={<FileSearch size={20} />} label="Review" />
                    <SidebarLink href="/admin/analytics" icon={<BarChart3 size={20} />} label="Analytics" />
                    <SidebarLink href="/admin/email-preview" icon={<Mail size={20} />} label="Email Preview" />
                    <SidebarLink href="/admin/settings" icon={<Settings size={20} />} label="Settings" />

                    <hr className="border-slate-100 my-4 mx-2" />
                    <div className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">View As</div>
                    <SidebarLink href="/profile/worker" icon={<User size={20} />} label="Worker Profile" />
                    <SidebarLink href="/profile/employer" icon={<Building2 size={20} />} label="Employer Profile" />
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

function AdminBreadcrumbs() {
    const pathname = usePathname();
    if (!pathname || pathname === '/admin') return null; // No breadcrumbs on dashboard

    const segments = pathname.replace('/admin', '').split('/').filter(Boolean);
    if (segments.length === 0) return null;

    const labelMap: Record<string, string> = {
        workers: 'Workers',
        employers: 'Employers',
        jobs: 'Jobs',
        queue: 'Queue',
        review: 'Document Review',
        analytics: 'Analytics',
        'email-preview': 'Email Preview',
        settings: 'Settings',
    };

    return (
        <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-4 font-medium">
            <Link href="/admin" className="hover:text-blue-600 transition-colors">Dashboard</Link>
            {segments.map((seg, idx) => {
                const href = '/admin/' + segments.slice(0, idx + 1).join('/');
                const isLast = idx === segments.length - 1;
                const label = labelMap[seg] || (seg.length > 20 ? seg.slice(0, 8) + '...' : seg);
                return (
                    <span key={idx} className="flex items-center gap-1.5">
                        <span className="text-slate-300">›</span>
                        {isLast ? (
                            <span className="text-slate-800 font-semibold">{label}</span>
                        ) : (
                            <Link href={href} className="hover:text-blue-600 transition-colors">{label}</Link>
                        )}
                    </span>
                );
            })}
        </nav>
    );
}

