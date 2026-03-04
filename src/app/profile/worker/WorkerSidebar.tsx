"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, FileText, Rocket, Pencil, ChevronRight, X } from "lucide-react";
import { useState, useEffect } from "react";

export default function WorkerSidebar() {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);

    // Close sidebar when route changes
    useEffect(() => {
        setIsOpen(false);
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
            {/* Mobile Toggle Button (Floating on left edge) */}
            <button
                onClick={() => setIsOpen(true)}
                className={`md:hidden fixed left-0 top-1/2 -translate-y-1/2 z-40 bg-white shadow-md border border-gray-200 px-1 py-4 rounded-r-xl transition-transform duration-300 ${isOpen ? '-translate-x-full' : 'translate-x-0'}`}
                aria-label="Open Menu"
            >
                <ChevronRight size={24} className="text-gray-500" />
            </button>

            {/* Mobile Backdrop */}
            {isOpen && (
                <div
                    className="md:hidden fixed inset-0 bg-black/40 z-40 backdrop-blur-sm transition-opacity"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Sidebar Container */}
            <div className={`
                fixed inset-y-0 left-0 z-50 w-72 bg-[#FAFAFA] transform transition-transform duration-300 ease-in-out
                md:relative md:w-64 md:translate-x-0 md:flex-shrink-0 md:bg-transparent md:z-0
                ${isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full shadow-none"}
            `}>
                <div className="h-full overflow-y-auto px-4 py-8 md:p-0">
                    {/* Mobile Header with Close Button */}
                    <div className="flex justify-between items-center mb-6 md:hidden px-2">
                        <h2 className="font-bold text-lg text-gray-900">Menu</h2>
                        <button onClick={() => setIsOpen(false)} className="p-2 bg-gray-100 rounded-full text-gray-600">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="bg-white rounded-xl p-2 shadow-sm border border-gray-200 md:sticky md:top-24">
                        <SidebarLink
                            href="/profile/worker"
                            icon={<User size={18} />}
                            label="Profile Info"
                            active={pathname === "/profile/worker"}
                        />
                        <SidebarLink
                            href="/profile/worker/documents"
                            icon={<FileText size={18} />}
                            label="Documents"
                            active={pathname === "/profile/worker/documents"}
                        />
                        <SidebarLink
                            href="/profile/worker/queue"
                            icon={<Rocket size={18} />}
                            label="Application Status"
                            active={pathname === "/profile/worker/queue"}
                        />

                        <div className="my-2 border-t border-gray-100"></div>

                        <SidebarLink
                            href="/profile/worker/edit"
                            icon={<Pencil size={18} />}
                            label="Edit Profile"
                            active={pathname === "/profile/worker/edit"}
                        />
                    </div>
                </div>
            </div>
        </>
    );
}

function SidebarLink({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active: boolean }) {
    return (
        <Link
            href={href}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors mb-0.5 ${active
                ? 'bg-gray-100/80 text-gray-900 border border-gray-200/50'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 border border-transparent'
                }`}
        >
            <span className={active ? 'text-gray-900' : 'text-gray-400'}>{icon}</span>
            {label}
        </Link>
    );
}
