"use client";

import {
    LayoutDashboard,
    Users,
    Building2,
    AlertTriangle,
    Settings,
    Mail,
    MailX,
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
import { createPortal } from "react-dom";
import type { User as SupabaseUser } from "@supabase/supabase-js";

type AppShellVariant = "public" | "dashboard" | "admin";

interface AppShellProps {
    children: React.ReactNode;
    user: SupabaseUser | null;
    variant?: AppShellVariant;
}

export default function AppShell({ children, user, variant = "dashboard" }: AppShellProps) {
    const [isDesktop, setIsDesktop] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();
    const searchParams = useSearchParams();

    useEffect(() => {
        if (typeof window === "undefined") return;

        const mediaQuery = window.matchMedia("(min-width: 1024px)");
        const syncViewportState = (matches: boolean) => {
            setIsDesktop(matches);
            setIsOpen(matches);
        };

        syncViewportState(mediaQuery.matches);

        const handleChange = (event: MediaQueryListEvent) => {
            syncViewportState(event.matches);
        };

        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
    }, []);

    // Close sidebar drawer on mobile when route changes
    useEffect(() => {
        if (!isDesktop) {
            const timeoutId = window.setTimeout(() => setIsOpen(false), 0);
            return () => window.clearTimeout(timeoutId);
        }
    }, [pathname, searchParams, isDesktop]);

    // Swipe to open/close logic (mostly for mobile)
    useEffect(() => {
        let touchStartX = 0;
        let touchEndX = 0;

        const handleTouchStart = (e: TouchEvent) => {
            touchStartX = e.targetTouches[0].clientX;
        };

        const handleTouchEnd = (e: TouchEvent) => {
            touchEndX = e.changedTouches[0].clientX;
            if (isDesktop) return;
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
    }, [isDesktop]);

    const normalizedUserType = normalizeUserType(user?.user_metadata?.user_type);
    const isAdminPreview = normalizedUserType === "admin" && variant !== "admin";
    const sidebarExpanded = isAdminPreview && isDesktop ? true : isOpen;
    const inspectId = searchParams.get("inspect");
    const previewLabel = pathname?.startsWith("/profile/agency")
        ? "Agency Workspace Preview"
        : pathname?.startsWith("/profile/employer")
            ? "Employer Profile Preview"
            : pathname?.startsWith("/profile/worker")
                ? "Worker Profile Preview"
                : "Profile Preview";
    const previewMessage = pathname?.startsWith("/profile/agency")
        ? inspectId
            ? "You are inspecting a real agency workspace as admin. Admin stays admin while you review the live structure and worker flow."
            : "You are previewing the agency workspace structure as admin. The add-worker modal opens for inspection only and does not persist preview data."
        : "You are viewing a role workspace safely in read-only mode. Use Back to Admin whenever you want to leave preview mode.";
    const sidebarWidthClass = sidebarExpanded ? "w-72 lg:w-[264px]" : "w-[60px] lg:w-[68px]";
    const mainOffsetClass = isDesktop
        ? sidebarExpanded
            ? "lg:ml-[280px]"
            : "lg:ml-[84px]"
        : "pl-[72px]";
    const handleMenuToggle = () => {
        if (isAdminPreview && isDesktop) return;
        setIsOpen((current) => !current);
    };

    return (
        <div className="min-h-screen bg-[#f5f5f4] flex flex-col font-montserrat">
            {/* Fixed Navbar */}
            <UnifiedNavbar
                variant={variant}
                user={user}
            />

            <div className="flex-1 flex max-w-[1920px] mx-auto w-full relative">
                {/* Mobile Backdrop */}
                {!isDesktop && sidebarExpanded && (
                    <div
                        className="fixed inset-x-0 bottom-0 top-[68px] bg-black/35 z-[54] backdrop-blur-sm transition-opacity"
                        onClick={() => setIsOpen(false)}
                    />
                )}

                {/* SIDEBAR (Desktop + Mobile Drawer/Thin Sidebar) */}
                <aside className={`
                    fixed left-0 z-[55] transition-all duration-300 ease-in-out px-2 lg:px-0
                    top-[74px] bottom-3 pt-0 pb-0
                    lg:left-4 lg:top-[80px] lg:bottom-4 lg:pt-0 lg:pb-0 lg:z-0
                    ${sidebarWidthClass}
                `}>
                    <div className="flex h-full flex-col items-center overflow-hidden rounded-[14px] border border-gray-200 bg-white p-1.5 shadow-sm backdrop-blur-sm lg:rounded-[14px] lg:border-white/60 lg:bg-white/50 lg:p-3 lg:items-stretch">
                        {/* Mobile Header with Close Button (only when open) */}
                        <div className={`flex justify-end items-center mb-6 lg:hidden px-4 w-full ${!isOpen && 'hidden'}`}>
                            <button onClick={() => setIsOpen(false)} className="rounded-[12px] bg-gray-200 p-2 text-gray-600">
                                <X size={20} />
                            </button>
                        </div>

                        <SidebarContent user={user} variant={variant} isCollapsed={!sidebarExpanded} onMenuToggle={handleMenuToggle} />
                    </div>
                </aside>

                {/* MAIN CONTENT */}
                <main className={`flex-1 min-w-0 w-full pb-10 pt-2 sm:pt-6 animate-fade-in-up transition-all duration-300 px-2.5 sm:px-6 lg:pl-6 lg:pr-8 ${mainOffsetClass}`}>
                    {isAdminPreview && (
                        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4 text-sm text-blue-900 md:flex-row md:items-center md:justify-between">
                            <div>
                                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-600">Admin Preview Mode</div>
                                <div className="mt-1 font-semibold">{previewLabel}</div>
                                <p className="mt-1 text-blue-800/80">
                                    {previewMessage}
                                </p>
                            </div>
                            <Link
                                href="/admin"
                                className="inline-flex items-center justify-center rounded-[12px] bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                            >
                                Back to Admin
                            </Link>
                        </div>
                    )}
                    {variant === 'admin' && <AdminBreadcrumbs />}
                    <div className="mx-auto w-full max-w-[1220px]">
                        {children}
                    </div>
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

type SidebarTone = "blue" | "emerald" | "amber" | "violet" | "rose" | "slate" | "red";

const SIDEBAR_TONE_STYLES: Record<SidebarTone, { active: string; icon: string }> = {
    blue: {
        active: "border border-blue-100 bg-blue-50 text-blue-700 shadow-sm",
        icon: "text-blue-600",
    },
    emerald: {
        active: "border border-emerald-100 bg-emerald-50 text-emerald-700 shadow-sm",
        icon: "text-emerald-600",
    },
    amber: {
        active: "border border-amber-100 bg-amber-50 text-amber-800 shadow-sm",
        icon: "text-amber-600",
    },
    violet: {
        active: "border border-violet-100 bg-violet-50 text-violet-700 shadow-sm",
        icon: "text-violet-600",
    },
    rose: {
        active: "border border-rose-100 bg-rose-50 text-rose-700 shadow-sm",
        icon: "text-rose-600",
    },
    slate: {
        active: "border border-slate-200 bg-slate-100 text-slate-800 shadow-sm",
        icon: "text-slate-700",
    },
    red: {
        active: "border border-red-100 bg-red-50 text-red-700 shadow-sm",
        icon: "text-red-600",
    },
};

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
    const homeLabel = variant === "admin"
        ? "Dashboard"
        : isAdminPreview
            ? "Back to Admin"
            : userType === "agency"
                ? "Agency Workers"
            : "Overview";
    const homeIcon = userType === "agency" && !isAdminPreview && variant !== "admin"
        ? <Users size={20} />
        : <LayoutDashboard size={20} />;
    const homeTone: SidebarTone = userType === "agency" && !isAdminPreview && variant !== "admin"
        ? "emerald"
        : "blue";
    return (
        <div className="flex h-full min-h-0 w-full flex-col items-center gap-1.5 overflow-y-auto lg:items-stretch">
            {/* Toggle Button Inside Box */}
            {onMenuToggle && (
                <button
                    onClick={onMenuToggle}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] transition-all duration-200 group w-full ${isCollapsed ? 'justify-center' : 'justify-start'} text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent`}
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
                icon={homeIcon}
                label={homeLabel}
                isCollapsed={isCollapsed}
                tone={homeTone}
                queryTab={variant !== "admin" && !isAdminPreview && userType === "employer" ? "company" : undefined}
            />

            {isWorkerWorkspace && (
                <>
                    <SidebarLink href={withInspect("/profile/worker/documents")} icon={<FileText size={20} />} label="Documents" isCollapsed={isCollapsed} tone="emerald" />
                    <SidebarLink href={withInspect("/profile/worker/queue")} icon={<ListOrdered size={20} />} label="Queue" isCollapsed={isCollapsed} tone="amber" />
                    <SidebarLink href={withInspect("/profile/worker/inbox")} icon={<MessageSquareMore size={20} />} label="Support" isCollapsed={isCollapsed} tone="violet" />
                    <SidebarLink href={withInspect("/profile/worker/edit")} icon={<Pencil size={20} />} label="Edit Profile" isCollapsed={isCollapsed} tone="rose" />
                    <SidebarLink href="/profile/settings" icon={<Settings size={20} />} label="Account Settings" isCollapsed={isCollapsed} tone="blue" />
                </>
            )}

            {isEmployerWorkspace && (
                <>
                    <SidebarLink href={withInspect("/profile/employer?tab=jobs")} icon={<Briefcase size={20} />} label="Job Requests" isCollapsed={isCollapsed} tone="emerald" queryTab="jobs" />
                    <SidebarLink href={withInspect("/profile/employer?tab=post-job")} icon={<Plus size={20} />} label="New Job Request" isCollapsed={isCollapsed} tone="violet" queryTab="post-job" />
                    <SidebarLink href="/profile/settings" icon={<Settings size={20} />} label="Account Settings" isCollapsed={isCollapsed} tone="blue" />
                </>
            )}

            {isAgencyWorkspace && (
                <>
                    {pathname?.startsWith("/profile/agency/workers/") && (
                        <SidebarLink
                            href={withInspect(pathname)}
                            icon={<User size={20} />}
                            label={isAdminPreview ? "Worker Editor Preview" : "Worker Editor"}
                            isCollapsed={isCollapsed}
                            tone="rose"
                        />
                    )}
                    <SidebarLink href="/profile/settings" icon={<Settings size={20} />} label="Account Settings" isCollapsed={isCollapsed} tone="blue" />
                </>
            )}

            {variant === 'admin' && (
                <>
                    <SidebarLink href="/admin/workers" icon={<Users size={20} />} label="Workers" isCollapsed={isCollapsed} tone="emerald" />
                    <SidebarLink href="/admin/employers" icon={<Building2 size={20} />} label="Employers" isCollapsed={isCollapsed} tone="blue" />
                    <SidebarLink href="/admin/agencies" icon={<Users size={20} />} label="Agencies" isCollapsed={isCollapsed} tone="violet" />
                    <div className={`px-3 pt-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ${isCollapsed ? 'hidden' : 'block'}`}>Previews</div>
                    <SidebarLink href="/profile/worker" icon={<User size={20} />} label="Preview Worker" isCollapsed={isCollapsed} tone="blue" />
                    <SidebarLink href="/profile/employer" icon={<Building2 size={20} />} label="Preview Employer" isCollapsed={isCollapsed} tone="blue" />
                    <SidebarLink href="/profile/agency" icon={<Users size={20} />} label="Preview Agency" isCollapsed={isCollapsed} tone="blue" />
                    <div className={`px-3 pt-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ${isCollapsed ? 'hidden' : 'block'}`}>Operations</div>
                    <SidebarLink href="/admin/jobs" icon={<Briefcase size={20} />} label="Jobs" isCollapsed={isCollapsed} tone="amber" />
                    <SidebarLink href="/admin/queue" icon={<ListOrdered size={20} />} label="Queue" isCollapsed={isCollapsed} tone="amber" />
                    <SidebarLink href="/admin/review" icon={<FileSearch size={20} />} label="Review" isCollapsed={isCollapsed} tone="rose" />
                    <SidebarLink href="/admin/analytics" icon={<BarChart3 size={20} />} label="Analytics" isCollapsed={isCollapsed} tone="blue" />
                    <SidebarLink href="/admin/inbox" icon={<MessageSquareMore size={20} />} label="Inbox" isCollapsed={isCollapsed} tone="violet" />
                    <SidebarLink href="/admin/exceptions" icon={<AlertTriangle size={20} />} label="Exceptions" isCollapsed={isCollapsed} tone="red" />
                    <SidebarLink href="/admin/email-health" icon={<MailX size={20} />} label="Email Health" isCollapsed={isCollapsed} tone="red" />
                    <SidebarLink href="/admin/email-preview" icon={<Mail size={20} />} label="Email Preview" isCollapsed={isCollapsed} tone="blue" />
                    <SidebarLink href="/admin/settings" icon={<Settings size={20} />} label="Settings" isCollapsed={isCollapsed} tone="slate" />
                </>
            )}

            <div className={`mt-auto w-full flex flex-col ${variant === 'admin' ? 'pt-4' : 'pt-2'}`}>
                <div className="my-2 border-t border-slate-100/80 w-full" />
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        setShowLogoutConfirm(true);
                    }}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] transition-all duration-200 group w-full ${isCollapsed ? 'justify-center' : 'justify-start'} text-slate-600 hover:bg-red-50 hover:text-red-600 font-medium`}
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
            {showLogoutConfirm && typeof document !== "undefined"
                ? createPortal(
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="w-full max-w-sm rounded-[14px] bg-white p-6 shadow-xl animate-in zoom-in-95 duration-200">
                            <h3 className="mb-2 text-xl font-bold text-gray-900">Log Out</h3>
                            <p className="mb-6 font-medium text-gray-600">Are you sure you want to log out from your account?</p>
                            <div className="flex flex-col justify-end gap-3 sm:flex-row">
                                <button
                                    onClick={() => setShowLogoutConfirm(false)}
                                    className="w-full rounded-[12px] bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-200 sm:w-auto"
                                >
                                    Cancel
                                </button>
                                <a
                                    href="/auth/signout"
                                    className="w-full rounded-[12px] bg-red-600 px-4 py-2 text-center text-sm font-semibold !text-white shadow-sm shadow-red-200 transition-colors hover:bg-red-700 sm:w-auto"
                                >
                                    Log Out
                                </a>
                            </div>
                        </div>
                    </div>,
                    document.body
                )
                : null}
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
    tone = "blue",
}: {
    href: string;
    icon: React.ReactNode;
    label: string;
    isCollapsed: boolean;
    disabled?: boolean;
    queryTab?: string;
    tone?: SidebarTone;
}) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const baseHref = href.split("?")[0];
    const currentTab = searchParams.get("tab") || "company";
    const toneStyles = SIDEBAR_TONE_STYLES[tone];
    const isActive = queryTab
        ? pathname === baseHref && currentTab === queryTab
        : pathname === baseHref || (baseHref !== '/admin' && baseHref !== '/profile/employer' && baseHref !== '/profile/worker' && baseHref !== '/profile/agency' && pathname.startsWith(baseHref));

    if (disabled) {
        return (
            <div
                title={isCollapsed ? `${label} (disabled in admin preview)` : undefined}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] transition-all duration-200 w-full ${isCollapsed ? 'justify-center' : 'justify-start'} text-slate-300 cursor-not-allowed`}
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
            aria-current={isActive ? "page" : undefined}
            title={isCollapsed ? label : undefined}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] border border-transparent transition-all duration-200 group relative overflow-hidden w-full ${isCollapsed ? 'justify-center' : 'justify-start'} ${isActive
                ? toneStyles.active
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
        >
            <div className={`w-6 h-6 flex items-center justify-center shrink-0 transition-colors ${isActive ? toneStyles.icon : "text-slate-400 group-hover:text-slate-600"
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
        agencies: 'Agencies',
        jobs: 'Jobs',
        queue: 'Queue',
        review: 'Document Review',
        analytics: 'Analytics',
        inbox: 'Inbox',
        exceptions: 'Exceptions',
        'email-health': 'Email Health',
        'email-preview': 'Email Preview',
        settings: 'Settings',
    };

    return (
        <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-4 font-medium">
            <Link href="/admin" className="hover:text-blue-600 transition-colors">Dashboard</Link>
            {segments.map((seg, idx) => {
                const href = '/admin/' + segments.slice(0, idx + 1).join('/');
                const isLast = idx === segments.length - 1;
                const label = idx > 0 && segments[0] === "workers"
                    ? "Worker Detail"
                    : labelMap[seg] || (seg.length > 20 ? seg.slice(0, 8) + '...' : seg);
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

