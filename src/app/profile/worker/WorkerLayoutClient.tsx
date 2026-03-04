"use client";

import { useState } from "react";
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
    const [isOpen, setIsOpen] = useState(() => {
        if (typeof window === "undefined") return true;
        return window.innerWidth >= 768;
    });

    return (
        <div className="min-h-screen bg-[#FAFAFA] text-gray-900 flex flex-col">
            <UnifiedNavbar
                variant="dashboard"
                user={user}
                profileName={displayName}
            />
            <div className="flex-1 w-full max-w-[1920px] mx-auto relative flex">
                <WorkerSidebar isOpen={isOpen} setIsOpen={setIsOpen} />
                <div className={`flex-1 transition-all duration-300 w-full min-w-0 ${isOpen ? 'pl-[272px] md:pl-[280px]' : 'pl-[76px] md:pl-[84px]'}`}>
                    <main className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 md:px-8 pt-[12px] md:pt-[16px] pb-6 md:pb-8">
                        {children}
                    </main>
                </div>
            </div>
        </div>
    );
}
