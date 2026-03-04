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
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();

    // Initialize sidebar state based on screen size
    useEffect(() => {
        setIsOpen(window.innerWidth >= 1024);
    }, []);

    // Close sidebar on mobile when route changes
    useEffect(() => {
        if (window.innerWidth < 1024) {
            setIsOpen(false);
        }
    }, [pathname]);

    // Swipe to open/close logic (mostly for mobile)
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
                setIsOpen(true);
            }
            // Swipe left (close)
            if (touchStartX > 50 && touchStartX - touchEndX > 50) {
                setIsOpen(false);
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
            <UnifiedNavbar
                variant={variant}
                user={user}
            />

            <div className="flex-1 flex max-w-[1920px] mx-auto w-full pt-6 relative">
                {/* Mobile Backdrop */}
                {isOpen && (
                    <div
                        className="lg:hidden fixed inset-0 bg-black/40 z-40 backdrop-blur-sm transition-opacity delay-75"
                        onClick={() => setIsOpen(false)}
                    />
                )}

                {/* SIDEBAR (Desktop + Mobile Drawer/Thin Sidebar) */}
                <aside className={`
                    fixed inset-y-0 left-0 z-50 bg-[#F8FAFC] transform transition-all duration-300 ease-in-out border-r border-[#E2E8F0] shadow-sm
                    lg:top-[80px] lg:bottom-0 lg:overflow-y-auto lg:px-4 lg:pb-4 lg:bg-transparent lg:border-none lg:shadow-none lg:z-0
                    pt-[64px] lg:pt-0
                    ${isOpen ? "w-72 lg:w-[280px] translate-x-0 shadow-2xl lg:shadow-none" : "w-[68px] translate-x-0"}
                `}>
                    <div className="h-full overflow-y-auto lg:p-4 lg:bg-white/50 lg:backdrop-blur-sm lg:border lg:border-white/60 lg:shadow-sm lg:rounded-2xl lg:h-[calc(100vh-100px)] flex flex-col items-center lg:items-stretch py-4">
                        {/* Toggle Button in Sidebar */}
                        <button
                            onClick={() => setIsOpen(!isOpen)}
                            className={`p-2 mb-4 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0 ${isOpen ? 'self-start ml-2 lg:ml-0' : 'mx-auto'}`}
                            aria-label="Toggle Menu"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                        {/* Mobile Header with Close Button (only when open) */}
                        <div className={`flex justify-between items-center mb-6 lg:hidden px-4 w-full ${!isOpen && 'hidden'}`}>
                            <h2 className="font-bold text-lg text-gray-900">Menu</h2>
                            <button onClick={() => setIsOpen(false)} className="p-2 bg-gray-200 rounded-full text-gray-600">
                                <X size={20} />
                            </button>
                        </div>

                        <SidebarContent user={user} variant={variant} isCollapsed={!isOpen} />
                    </div>
                </aside>

                {/* MAIN CONTENT */}
                <main className={`flex-1 max-w-[1000px] mx-auto w-full pb-10 animate-fade-in-up transition-all duration-300 px-3 sm:px-6 ${isOpen ? 'pl-[84px] lg:pl-3 lg:ml-[280px]' : 'pl-[84px] lg:pl-3 lg:ml-[68px]'}`}>
                    {variant === 'admin' && <AdminBreadcrumbs />}
                    {children}
                </main>
            </div>
        </div>
    );
}

function SidebarContent({ user, variant, isCollapsed }: { user: any, variant: string, isCollapsed: boolean }) {
    const userType = user?.user_metadata?.user_type;

    // Determine Home link based on context
    const homeHref = variant === 'admin' ? '/admin'
        : userType === 'employer' ? '/profile/employer'
            : '/profile/worker';

    return (
        <div className="space-y-1.5 w-full flex flex-col items-center lg:items-stretch">
            <SidebarLink href={homeHref} icon={<LayoutDashboard size={20} />} label="Dashboard" isCollapsed={isCollapsed} />

            {/* Only show profile link outside admin mode */}
            {variant !== 'admin' && (
                <SidebarLink
                    href={userType === 'employer' ? '/profile/employer' : '/profile/worker'}
                    icon={<img src={user?.user_metadata?.avatar_url || "/logo.png"} className="w-6 h-6 rounded-full object-cover ring-2 ring-white shadow-sm" />}
                    label={user?.user_metadata?.full_name || "My Profile"}
                    isCollapsed={isCollapsed}
                />
            )}

            <hr className="border-slate-100 my-4 lg:mx-2 w-full max-w-[40px] lg:max-w-none" />

            <div className={`px-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ${isCollapsed ? 'hidden' : 'block'}`}>Menu</div>

            {variant === 'admin' && (
                <>
                    <SidebarLink href="/admin/workers" icon={<Users size={20} />} label="Workers" isCollapsed={isCollapsed} />
                    <SidebarLink href="/admin/employers" icon={<Building2 size={20} />} label="Employers" isCollapsed={isCollapsed} />
                    <SidebarLink href="/admin/jobs" icon={<Briefcase size={20} />} label="Jobs" isCollapsed={isCollapsed} />
                    <SidebarLink href="/admin/queue" icon={<ListOrdered size={20} />} label="Queue" isCollapsed={isCollapsed} />
                    <SidebarLink href="/admin/review" icon={<FileSearch size={20} />} label="Review" isCollapsed={isCollapsed} />
                    <SidebarLink href="/admin/analytics" icon={<BarChart3 size={20} />} label="Analytics" isCollapsed={isCollapsed} />
                    <SidebarLink href="/admin/email-preview" icon={<Mail size={20} />} label="Email Preview" isCollapsed={isCollapsed} />
                    <SidebarLink href="/admin/settings" icon={<Settings size={20} />} label="Settings" isCollapsed={isCollapsed} />

                    <hr className="border-slate-100 my-4 lg:mx-2 w-full max-w-[40px] lg:max-w-none" />
                    <div className={`px-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ${isCollapsed ? 'hidden' : 'block'}`}>View As</div>
                    <SidebarLink href="/profile/worker" icon={<User size={20} />} label="Worker Profile" isCollapsed={isCollapsed} />
                    <SidebarLink href="/profile/employer" icon={<Building2 size={20} />} label="Employer Profile" isCollapsed={isCollapsed} />
                </>
            )}

            {/* Employer shortcuts only outside admin mode */}
            {variant !== 'admin' && userType === 'employer' && (
                <>
                    <SidebarLink href="/profile/employer/jobs" icon={<Briefcase size={20} />} label="Job Postings" isCollapsed={isCollapsed} />
                </>
            )}

            {/* Account settings for all non-admin users */}
            {variant !== 'admin' && (
                <>
                    <hr className="border-slate-100 my-4 lg:mx-2 w-full max-w-[40px] lg:max-w-none" />
                    <SidebarLink href="/profile/settings" icon={<Settings size={20} />} label="Account Settings" isCollapsed={isCollapsed} />
                </>
            )}
        </div>
    );
}

function SidebarLink({ href, icon, label, isCollapsed }: { href: string; icon: React.ReactNode; label: string; isCollapsed: boolean }) {
    const pathname = usePathname();
    const isActive = pathname === href || (href !== '/admin' && href !== '/profile/employer' && href !== '/profile/worker' && pathname.startsWith(href));

    return (
        <Link
            href={href}
            title={isCollapsed ? label : undefined}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 group relative overflow-hidden w-full ${isCollapsed ? 'justify-center' : 'justify-start'} ${isActive
                ? "bg-blue-50 text-blue-700 shadow-sm"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
        >
            {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 bg-blue-500 rounded-r-md" />
            )}
            <div className={`w-6 h-6 flex items-center justify-center shrink-0 transition-colors ${isActive ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"
                }`}>
                {icon}
            </div>
            <span className={`font-medium text-[14px] whitespace-nowrap ${isActive ? "font-semibold" : ""} ${isCollapsed ? "hidden" : "block"}`}>{label}</span>
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

