"use client";

import {
    LayoutDashboard,
    Users,
    Building2,
    Settings,
    Mail,
    MessageSquareMore,
    Briefcase,
    User,
    LogOut,
    BarChart3,
    ListOrdered,
    FileSearch,
    FileText,
    Pencil,
    Plus,
    X,
} from "lucide-react";
import Link from "next/link";
import UnifiedNavbar from "./UnifiedNavbar";
import { normalizeUserType } from "@/lib/domain";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";

type AppShellVariant = "public" | "dashboard" | "admin";

interface AppShellProps {
    children: React.ReactNode;
    user: SupabaseUser | null;
    variant?: AppShellVariant;
}

export default function AppShell({ children, user, variant = "dashboard" }: AppShellProps) {
    const [isOpen, setIsOpen] = useState(() => {
        if (typeof window === "undefined") return true;
        return window.innerWidth >= 1024;
    });
    const pathname = usePathname();

    // Close sidebar on mobile when route changes
    useEffect(() => {
        if (typeof window === "undefined") return;
        if (window.innerWidth < 1024) {
            const timeoutId = window.setTimeout(() => setIsOpen(false), 0);
            return () => window.clearTimeout(timeoutId);
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

    const normalizedUserType = normalizeUserType(user?.user_metadata?.user_type);
    const isAdminPreview = normalizedUserType === "admin" && variant !== "admin";
    const sidebarExpanded = isAdminPreview && typeof window !== "undefined" && window.innerWidth >= 1024
        ? true
        : isOpen;
    const previewLabel = pathname?.startsWith("/profile/agency")
        ? "Agency Workspace Preview"
        : pathname?.startsWith("/profile/employer")
            ? "Employer Profile Preview"
            : pathname?.startsWith("/profile/worker")
                ? "Worker Profile Preview"
                : "Profile Preview";

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-montserrat">
            {/* Fixed Navbar */}
            <UnifiedNavbar
                variant={variant}
                user={user}
            />

            <div className="flex-1 flex max-w-[1920px] mx-auto w-full pt-6 relative">
                {/* Mobile Backdrop */}
                {sidebarExpanded && (
                    <div
                        className="lg:hidden fixed inset-0 bg-black/40 z-40 backdrop-blur-sm transition-opacity delay-75"
                        onClick={() => setIsOpen(false)}
                    />
                )}

                {/* SIDEBAR (Desktop + Mobile Drawer/Thin Sidebar) */}
                <aside className={`
                    fixed inset-y-0 left-0 z-50 transform transition-all duration-300 ease-in-out px-2 lg:px-0
                    lg:top-[80px] lg:bottom-0 lg:overflow-y-auto lg:pb-4 lg:z-0
                    pt-[64px] lg:pt-0
                    ${sidebarExpanded ? "w-72 lg:w-[280px] translate-x-0" : "w-[68px] translate-x-0"}
                `}>
                    <div className="h-full overflow-y-auto p-2 lg:p-4 bg-white lg:bg-white/50 backdrop-blur-sm border border-gray-200 lg:border-white/60 shadow-sm rounded-xl lg:rounded-2xl lg:h-[calc(100vh-100px)] flex flex-col items-center lg:items-stretch">
                        {/* Mobile Header with Close Button (only when open) */}
                        <div className={`flex justify-between items-center mb-6 lg:hidden px-4 w-full ${!isOpen && 'hidden'}`}>
                            <h2 className="font-bold text-lg text-gray-900">Menu</h2>
                            <button onClick={() => setIsOpen(false)} className="p-2 bg-gray-200 rounded-full text-gray-600">
                                <X size={20} />
                            </button>
                        </div>

                            <SidebarContent user={user} variant={variant} isCollapsed={!sidebarExpanded} onMenuToggle={() => setIsOpen(!sidebarExpanded)} />
                    </div>
                </aside>

                {/* MAIN CONTENT */}
                <main className={`flex-1 max-w-[1000px] mx-auto w-full pb-10 animate-fade-in-up transition-all duration-300 px-3 sm:px-6 ${sidebarExpanded ? 'pl-[84px] lg:pl-3 lg:ml-[280px]' : 'pl-[84px] lg:pl-3 lg:ml-[68px]'}`}>
                    {isAdminPreview && (
                        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4 text-sm text-blue-900 md:flex-row md:items-center md:justify-between">
                            <div>
                                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-600">Admin Preview Mode</div>
                                <div className="mt-1 font-semibold">{previewLabel}</div>
                                <p className="mt-1 text-blue-800/80">
                                    You are viewing a role-specific workspace as an admin. Dashboard always returns to the admin panel.
                                </p>
                            </div>
                            <Link
                                href="/admin"
                                className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                            >
                                Back to Admin
                            </Link>
                        </div>
                    )}
                    {variant === 'admin' && <AdminBreadcrumbs />}
                    {children}
                </main>
            </div>
        </div>
    );
}

interface SidebarContentProps {
    user: SupabaseUser | null;
    variant: AppShellVariant;
    isCollapsed: boolean;
    onMenuToggle?: () => void;
}

function SidebarContent({ user, variant, isCollapsed, onMenuToggle }: SidebarContentProps) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const userType = normalizeUserType(user?.user_metadata?.user_type) || "worker";
    const isAdminPreview = userType === "admin" && variant !== "admin";
    const isWorkerWorkspace = variant !== "admin" && (userType === "worker" || (isAdminPreview && pathname?.startsWith("/profile/worker")));
    const isEmployerWorkspace = variant !== "admin" && (userType === "employer" || (isAdminPreview && pathname?.startsWith("/profile/employer")));
    const isAgencyWorkspace = variant !== "admin" && (userType === "agency" || (isAdminPreview && pathname?.startsWith("/profile/agency")));
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const inspectId = searchParams.get("inspect");

    const withInspect = (href: string) => {
        if (!isAdminPreview || !inspectId) return href;
        const [basePath, queryString] = href.split("?");
        const params = new URLSearchParams(queryString || "");
        params.set("inspect", inspectId);
        const nextQuery = params.toString();
        return nextQuery ? `${basePath}?${nextQuery}` : basePath;
    };

    // Determine Home link based on context
    const homeHref = variant === 'admin' || isAdminPreview ? '/admin'
        : userType === 'employer' ? '/profile/employer'
            : userType === 'agency' ? '/profile/agency'
                : '/profile/worker';
    const homeLabel = isAdminPreview
        ? "Admin Dashboard"
        : userType === "employer"
            ? "Employer Overview"
            : userType === "agency"
                ? "Agency Dashboard"
                : "Worker Overview";

    return (
        <div className="space-y-1.5 w-full flex flex-col items-center lg:items-stretch">
            {/* Toggle Button Inside Box */}
            {onMenuToggle && (
                <button
                    onClick={onMenuToggle}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 group w-full ${isCollapsed ? 'justify-center' : 'justify-start'} text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent`}
                    aria-label="Toggle Menu"
                >
                    <div className="w-6 h-6 flex items-center justify-center shrink-0 transition-colors text-slate-400 group-hover:text-slate-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </div>
                </button>
            )}

            <SidebarLink
                href={homeHref}
                icon={<LayoutDashboard size={20} />}
                label={homeLabel}
                isCollapsed={isCollapsed}
                queryTab={variant !== "admin" && !isAdminPreview && userType === "employer" ? "company" : undefined}
            />

            {/* Only show profile link outside admin mode */}
            {variant !== 'admin' && !isAdminPreview && (
                <SidebarLink
                    href={userType === 'employer' ? '/profile/employer' : userType === 'agency' ? '/profile/agency' : '/profile/worker'}
                    icon={
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={user?.user_metadata?.avatar_url || "/logo-hands.png"}
                            alt="Profile avatar"
                            className="w-6 h-6 rounded-full object-cover ring-2 ring-white shadow-sm"
                        />
                    }
                    label={user?.user_metadata?.full_name || "My Profile"}
                    isCollapsed={isCollapsed}
                />
            )}

            <div className={`px-3 pt-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ${isCollapsed ? 'hidden' : 'block'}`}>Menu</div>

            {isWorkerWorkspace && (
                <>
                    <div className={`px-3 pt-1 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ${isCollapsed ? 'hidden' : 'block'}`}>Worker Workspace</div>
                    <SidebarLink href={withInspect("/profile/worker/documents")} icon={<FileText size={20} />} label="Documents" isCollapsed={isCollapsed} />
                    <SidebarLink href={withInspect("/profile/worker/queue")} icon={<ListOrdered size={20} />} label="Queue & Status" isCollapsed={isCollapsed} />
                    <SidebarLink href={withInspect("/profile/worker/inbox")} icon={<MessageSquareMore size={20} />} label="Support Inbox" isCollapsed={isCollapsed} disabled={isAdminPreview} />
                    <SidebarLink href="/profile/worker/edit" icon={<Pencil size={20} />} label="Edit Profile" isCollapsed={isCollapsed} disabled={isAdminPreview} />
                </>
            )}

            {isEmployerWorkspace && (
                <>
                    <div className={`px-3 pt-1 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ${isCollapsed ? 'hidden' : 'block'}`}>Employer Workspace</div>
                    <SidebarLink href={withInspect("/profile/employer?tab=jobs")} icon={<Briefcase size={20} />} label="Job Requests" isCollapsed={isCollapsed} queryTab="jobs" />
                    <SidebarLink href={withInspect("/profile/employer?tab=post-job")} icon={<Plus size={20} />} label="Post a Job" isCollapsed={isCollapsed} queryTab="post-job" />
                </>
            )}

            {isAgencyWorkspace && (
                <>
                    <div className={`px-3 pt-1 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ${isCollapsed ? 'hidden' : 'block'}`}>Agency Workspace</div>
                    <SidebarLink href={withInspect("/profile/agency")} icon={<Users size={20} />} label="Agency Workers" isCollapsed={isCollapsed} />
                    {pathname?.startsWith("/profile/agency/workers/") && (
                        <SidebarLink
                            href={withInspect(pathname)}
                            icon={<User size={20} />}
                            label={isAdminPreview ? "Worker Editor Preview" : "Worker Editor"}
                            isCollapsed={isCollapsed}
                        />
                    )}
                </>
            )}

            {isAdminPreview && (
                <>
                    <div className={`px-3 pt-1 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ${isCollapsed ? 'hidden' : 'block'}`}>UI Previews</div>
                    <SidebarLink href={withInspect("/profile/worker")} icon={<User size={20} />} label="Worker Preview" isCollapsed={isCollapsed} />
                    <SidebarLink href={withInspect("/profile/employer")} icon={<Building2 size={20} />} label="Employer Preview" isCollapsed={isCollapsed} />
                    <SidebarLink href={withInspect("/profile/agency")} icon={<Users size={20} />} label="Agency Preview" isCollapsed={isCollapsed} />
                </>
            )}

            {variant === 'admin' && (
                <>
                    <SidebarLink href="/admin/workers" icon={<Users size={20} />} label="Workers" isCollapsed={isCollapsed} />
                    <SidebarLink href="/admin/employers" icon={<Building2 size={20} />} label="Employers" isCollapsed={isCollapsed} />
                    <SidebarLink href="/admin/agencies" icon={<Users size={20} />} label="Agencies" isCollapsed={isCollapsed} />
                    <SidebarLink href="/admin/jobs" icon={<Briefcase size={20} />} label="Jobs" isCollapsed={isCollapsed} />
                    <SidebarLink href="/admin/queue" icon={<ListOrdered size={20} />} label="Queue" isCollapsed={isCollapsed} />
                    <SidebarLink href="/admin/review" icon={<FileSearch size={20} />} label="Review" isCollapsed={isCollapsed} />
                    <SidebarLink href="/admin/analytics" icon={<BarChart3 size={20} />} label="Analytics" isCollapsed={isCollapsed} />
                    <SidebarLink href="/admin/inbox" icon={<MessageSquareMore size={20} />} label="Inbox" isCollapsed={isCollapsed} />
                    <SidebarLink href="/admin/email-preview" icon={<Mail size={20} />} label="Email Preview" isCollapsed={isCollapsed} />
                    <SidebarLink href="/admin/settings" icon={<Settings size={20} />} label="Settings" isCollapsed={isCollapsed} />

                    <div className={`px-3 pt-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ${isCollapsed ? 'hidden' : 'block'}`}>UI Previews</div>
                    <SidebarLink href="/profile/worker" icon={<User size={20} />} label="Worker Profile" isCollapsed={isCollapsed} />
                    <SidebarLink href="/profile/employer" icon={<Building2 size={20} />} label="Employer Profile" isCollapsed={isCollapsed} />
                    <SidebarLink href="/profile/agency" icon={<Building2 size={20} />} label="Agency Dashboard" isCollapsed={isCollapsed} />
                </>
            )}

            {/* Employer shortcuts only outside admin mode */}
            {variant !== 'admin' && userType === 'employer' && (
                <>
                    <SidebarLink href="/profile/employer/jobs" icon={<Briefcase size={20} />} label="Job Postings" isCollapsed={isCollapsed} />
                </>
            )}

            {variant !== 'admin' && userType === 'agency' && (
                <>
                    <SidebarLink href="/profile/agency" icon={<Users size={20} />} label="Agency Workers" isCollapsed={isCollapsed} />
                </>
            )}

            {/* Account settings for all non-admin users */}
            {variant !== 'admin' && !isAdminPreview && (
                <div className="pt-2">
                    <SidebarLink href="/profile/settings" icon={<Settings size={20} />} label="Account Settings" isCollapsed={isCollapsed} />
                </div>
            )}

            <div className={`mt-auto w-full flex flex-col ${variant === 'admin' ? 'pt-4' : 'pt-2'}`}>
                <div className="my-2 border-t border-slate-100/80 w-full" />
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        setShowLogoutConfirm(true);
                    }}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 group w-full ${isCollapsed ? 'justify-center' : 'justify-start'} text-slate-600 hover:bg-red-50 hover:text-red-600 font-medium`}
                    title={isCollapsed ? "Logout" : undefined}
                >
                    <div className="w-6 h-6 flex items-center justify-center shrink-0 transition-colors text-slate-400 group-hover:text-red-500">
                        <LogOut size={20} />
                    </div>
                    <span className={`whitespace-nowrap transition-all duration-300 font-medium ${isCollapsed ? 'hidden' : 'block'}`}>
                        Logout
                    </span>
                </button>
            </div>
            {/* Logout Confirmation Modal */}
            {showLogoutConfirm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Log Out</h3>
                        <p className="text-gray-600 mb-6 font-medium">Are you sure you want to log out from your account?</p>
                        <div className="flex justify-end gap-3 flex-col sm:flex-row">
                            <button
                                onClick={() => setShowLogoutConfirm(false)}
                                className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors w-full sm:w-auto"
                            >
                                Cancel
                            </button>
                            <a
                                href="/auth/signout"
                                className="px-4 py-2 text-sm font-semibold !text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors text-center w-full sm:w-auto shadow-sm shadow-red-200"
                            >
                                Log Out
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function SidebarLink({
    href,
    icon,
    label,
    isCollapsed,
    disabled = false,
    queryTab,
}: {
    href: string;
    icon: React.ReactNode;
    label: string;
    isCollapsed: boolean;
    disabled?: boolean;
    queryTab?: string;
}) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const baseHref = href.split("?")[0];
    const currentTab = searchParams.get("tab") || "company";
    const isActive = queryTab
        ? pathname === baseHref && currentTab === queryTab
        : pathname === baseHref || (baseHref !== '/admin' && baseHref !== '/profile/employer' && baseHref !== '/profile/worker' && baseHref !== '/profile/agency' && pathname.startsWith(baseHref));

    if (disabled) {
        return (
            <div
                title={isCollapsed ? `${label} (disabled in admin preview)` : undefined}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 w-full ${isCollapsed ? 'justify-center' : 'justify-start'} text-slate-300 cursor-not-allowed`}
            >
                <div className="w-6 h-6 flex items-center justify-center shrink-0 text-slate-300">
                    {icon}
                </div>
                <span className={`font-medium text-[14px] whitespace-nowrap ${isCollapsed ? "hidden" : "block"}`}>{label}</span>
            </div>
        );
    }

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
        inbox: 'Inbox',
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

