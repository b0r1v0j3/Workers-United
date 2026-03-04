"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, FileText, Rocket, Pencil, ChevronRight, X, LogOut } from "lucide-react";
import { useEffect, useState } from "react";

export default function WorkerSidebar({ isOpen, setIsOpen }: { isOpen: boolean, setIsOpen: (v: boolean) => void }) {
    const pathname = usePathname();
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

    // Close sidebar when route changes
    useEffect(() => {
        setIsOpen(false);
    }, [pathname, setIsOpen]);

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

    return (
        <>
            {/* Mobile Backdrop */}
            {isOpen && (
                <div
                    className="md:hidden fixed inset-0 bg-black/40 z-40 backdrop-blur-sm transition-opacity"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Sidebar Container */}
            <div className={`
                fixed inset-y-0 left-0 z-40 bg-transparent transform transition-all duration-300 ease-in-out border-none
                top-[72px] md:top-[80px] pt-0 pl-2 md:pl-4 bottom-0 pb-4 md:z-0
                ${isOpen ? "w-[264px] md:w-[264px] translate-x-0" : "w-[68px] md:w-[68px] translate-x-0"}
            `}>
                <div className="h-full overflow-y-auto px-2 md:px-0 py-6 md:py-0 flex flex-col items-center md:items-stretch">
                    <div className="bg-white rounded-xl p-2 md:p-3 shadow-sm border border-gray-200 w-full md:h-[calc(100vh-100px)] flex flex-col">
                        {/* Toggle Button in Sidebar */}
                        <button
                            onClick={() => setIsOpen(!isOpen)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-0.5 ${!isOpen ? 'justify-center' : 'justify-start'} text-gray-500 hover:bg-gray-50 hover:text-gray-900 border border-transparent`}
                            aria-label="Toggle Menu"
                        >
                            <span className="shrink-0 text-gray-400">
                                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            </span>
                        </button>

                        <SidebarLink
                            href="/profile/worker"
                            icon={<User size={18} />}
                            label="Profile Info"
                            active={pathname === "/profile/worker"}
                            isCollapsed={!isOpen}
                        />
                        <SidebarLink
                            href="/profile/worker/documents"
                            icon={<FileText size={18} />}
                            label="Documents"
                            active={pathname === "/profile/worker/documents"}
                            isCollapsed={!isOpen}
                        />
                        <SidebarLink
                            href="/profile/worker/queue"
                            icon={<Rocket size={18} />}
                            label="Application Status"
                            active={pathname === "/profile/worker/queue"}
                            isCollapsed={!isOpen}
                        />

                        <SidebarLink
                            href="/profile/worker/edit"
                            icon={<Pencil size={18} />}
                            label="Edit Profile"
                            active={pathname === "/profile/worker/edit"}
                            isCollapsed={!isOpen}
                        />

                        <div className="mt-auto w-full flex flex-col pt-2">
                            <div className="my-2 border-t border-gray-100 w-full" />

                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    setShowLogoutConfirm(true);
                                }}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group ${!isOpen ? 'justify-center' : 'justify-start'} text-gray-500 hover:bg-red-50 hover:text-red-600 border border-transparent`}
                                title={!isOpen ? "Logout" : undefined}
                            >
                                <span className="shrink-0 text-gray-400 group-hover:text-red-500"><LogOut size={18} /></span>
                                <span className={`whitespace-nowrap transition-all duration-300 ${!isOpen ? "hidden" : "block"}`}>Logout</span>
                            </button>
                        </div>
                    </div>
                </div>
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
        </>
    );
}

function SidebarLink({ href, icon, label, active, isCollapsed }: { href: string; icon: React.ReactNode; label: string; active: boolean; isCollapsed: boolean }) {
    return (
        <Link
            href={href}
            title={isCollapsed ? label : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-0.5 ${isCollapsed ? 'justify-center' : 'justify-start'} ${active
                ? 'bg-gray-100/80 text-gray-900 border border-gray-200/50'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 border border-transparent'
                }`}
        >
            <span className={`shrink-0 ${active ? 'text-gray-900' : 'text-gray-400'}`}>{icon}</span>
            <span className={`whitespace-nowrap transition-all duration-300 ${isCollapsed ? "hidden" : "block"}`}>{label}</span>
        </Link>
    );
}
