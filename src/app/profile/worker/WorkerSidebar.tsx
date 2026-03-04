"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, FileText, Rocket, Pencil, ChevronRight, X } from "lucide-react";
import { useEffect } from "react";

export default function WorkerSidebar({ isOpen, setIsOpen }: { isOpen: boolean, setIsOpen: (v: boolean) => void }) {
    const pathname = usePathname();

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
                fixed inset-y-0 left-0 z-40 bg-[#FAFAFA] transform transition-all duration-300 ease-in-out border-r border-gray-200
                md:relative md:w-64 md:translate-x-0 md:flex-shrink-0 md:bg-transparent md:border-none md:z-0 md:pt-0 pt-[64px]
                ${isOpen ? "w-72 translate-x-0 shadow-2xl" : "w-[68px] translate-x-0 shadow-sm"}
            `}>
                <div className="h-full overflow-y-auto px-2 md:px-0 py-6 md:py-0 flex flex-col items-center md:items-stretch">
                    {/* Toggle Button in Sidebar */}
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className={`p-2 mb-4 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0 ${isOpen ? 'self-start ml-2 md:ml-0' : 'mx-auto'}`}
                        aria-label="Toggle Menu"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                    {/* Mobile Header with Close Button */}
                    <div className={`flex justify-between items-center mb-6 md:hidden px-2 w-full ${!isOpen && 'hidden'}`}>
                        <h2 className="font-bold text-lg text-gray-900">Menu</h2>
                        <button onClick={() => setIsOpen(false)} className="p-2 bg-gray-200 rounded-full text-gray-600">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="bg-white rounded-xl p-2 shadow-sm border border-gray-200 md:sticky md:top-24 w-full">
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

                        <div className="my-2 border-t border-gray-100 w-full max-w-[30px] mx-auto md:max-w-none"></div>

                        <SidebarLink
                            href="/profile/worker/edit"
                            icon={<Pencil size={18} />}
                            label="Edit Profile"
                            active={pathname === "/profile/worker/edit"}
                            isCollapsed={!isOpen}
                        />
                    </div>
                </div>
            </div>
        </>
    );
}

function SidebarLink({ href, icon, label, active, isCollapsed }: { href: string; icon: React.ReactNode; label: string; active: boolean; isCollapsed: boolean }) {
    return (
        <Link
            href={href}
            title={isCollapsed ? label : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-0.5 ${isCollapsed ? 'justify-center md:justify-start' : 'justify-start'} ${active
                ? 'bg-gray-100/80 text-gray-900 border border-gray-200/50'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 border border-transparent'
                }`}
        >
            <span className={`shrink-0 ${active ? 'text-gray-900' : 'text-gray-400'}`}>{icon}</span>
            <span className={`whitespace-nowrap ${isCollapsed ? "hidden md:block" : "block"}`}>{label}</span>
        </Link>
    );
}
