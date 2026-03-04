"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, FileText, Rocket, Pencil } from "lucide-react";

export default function WorkerSidebar() {
    const pathname = usePathname();

    return (
        <div className="md:w-64 flex-shrink-0 space-y-2">
            <div className="bg-white rounded-xl p-2 shadow-sm border border-gray-200 sticky top-24">
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
