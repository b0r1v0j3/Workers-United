"use client";

import { useState, useEffect } from "react";
import UnifiedNavbar from "@/components/UnifiedNavbar";
import WorkerSidebar from "./WorkerSidebar";

export default function WorkerLayoutClient({
    children,
    user,
    displayName
}: {
    children: React.ReactNode;
    user: any;
    displayName: string;
}) {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        setIsOpen(window.innerWidth >= 768);
    }, []);

    return (
        <div className="min-h-screen bg-[#FAFAFA] text-gray-900 flex flex-col">
            <UnifiedNavbar
                variant="dashboard"
                user={user}
                profileName={displayName}
                onMenuToggle={() => setIsOpen(!isOpen)}
            />
            <div className="max-w-5xl mx-auto w-full px-2 sm:px-4 py-8 flex-1">
                <div className="flex flex-col md:flex-row gap-4 md:gap-6 relative">
                    <WorkerSidebar isOpen={isOpen} setIsOpen={setIsOpen} />
                    <div className="flex-1 min-w-0 pl-[72px] md:pl-0 transition-all duration-300">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}
