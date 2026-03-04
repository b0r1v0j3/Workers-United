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
            />
            <div className="flex-1 relative w-full flex">
                <WorkerSidebar isOpen={isOpen} setIsOpen={setIsOpen} />
                <main className={`flex-1 transition-all duration-300 w-full min-w-0 pl-[84px] ${isOpen ? 'md:pl-[272px]' : 'md:pl-[88px]'}`}>
                    <div className="max-w-[1400px] mx-auto w-full px-4 sm:px-8 py-8">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
