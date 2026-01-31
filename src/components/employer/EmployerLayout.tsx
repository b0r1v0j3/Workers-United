"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { cn } from "@/lib/utils";
import { Briefcase, Users, Bell, Settings, LogOut } from "lucide-react";

interface EmployerLayoutProps {
    children: React.ReactNode;
}

export function EmployerLayout({ children }: EmployerLayoutProps) {
    const [activeTab, setActiveTab] = useState("jobs");

    // Mock User
    const user = {
        company: "BuildCorp GmbH",
        email: "hr@buildcorp.com"
    };

    return (
        <div className="min-h-screen flex flex-col font-sans bg-[#f4f6fb]">
            <Header />

            <main className="flex-1 py-8">
                <div className="container mx-auto px-5 max-w-[1200px] flex items-start gap-8">

                    {/* Sidebar */}
                    <aside className="w-64 bg-white rounded-xl shadow-sm border border-border hidden md:block sticky top-24">
                        <div className="p-6 border-b border-border">
                            <h2 className="font-bold text-gray-900 truncate">{user.company}</h2>
                            <p className="text-xs text-muted truncate">{user.email}</p>
                        </div>

                        <nav className="p-4 space-y-1">
                            <button
                                onClick={() => setActiveTab("jobs")}
                                className={cn(
                                    "flex items-center gap-3 w-full px-4 py-3 text-sm font-medium rounded-lg transition-colors",
                                    activeTab === "jobs" ? "bg-primary-soft/10 text-primary" : "text-gray-600 hover:bg-gray-50"
                                )}
                            >
                                <Briefcase size={18} />
                                My Jobs
                            </button>

                            <button
                                onClick={() => setActiveTab("candidates")}
                                className={cn(
                                    "flex items-center gap-3 w-full px-4 py-3 text-sm font-medium rounded-lg transition-colors",
                                    activeTab === "candidates" ? "bg-primary-soft/10 text-primary" : "text-gray-600 hover:bg-gray-50"
                                )}
                            >
                                <Users size={18} />
                                Candidates <span className="ml-auto bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full">New</span>
                            </button>

                            <button
                                onClick={() => setActiveTab("notifications")}
                                className={cn(
                                    "flex items-center gap-3 w-full px-4 py-3 text-sm font-medium rounded-lg transition-colors",
                                    activeTab === "notifications" ? "bg-primary-soft/10 text-primary" : "text-gray-600 hover:bg-gray-50"
                                )}
                            >
                                <Bell size={18} />
                                Notifications
                            </button>

                            <div className="pt-4 mt-4 border-t border-border">
                                <button className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
                                    <Settings size={18} />
                                    Settings
                                </button>
                                <button className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                    <LogOut size={18} />
                                    Logout
                                </button>
                            </div>
                        </nav>
                    </aside>

                    {/* Main Content */}
                    <div className="flex-1">
                        {children}
                    </div>

                </div>
            </main>

            <Footer />
        </div>
    );
}
