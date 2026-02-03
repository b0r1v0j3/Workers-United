"use client";

import Link from "next/link";
import { useState } from "react";

interface GodModePanelProps {
    currentRole: "candidate" | "employer" | "admin";
    userName: string;
}

export function GodModePanel({ currentRole, userName }: GodModePanelProps) {
    const [isOpen, setIsOpen] = useState(false);

    const roles = [
        { key: "candidate", label: "👤 Worker Dashboard", href: "/dashboard" },
        { key: "employer", label: "🏢 Employer Dashboard", href: "/employer/dashboard" },
        { key: "admin", label: "⚡ Admin Panel", href: "/admin" },
    ];

    const quickActions = [
        { label: "Skip to Verified", action: "verify" },
        { label: "Skip to Queue", action: "queue" },
        { label: "Skip to Offer", action: "offer" },
        { label: "Reset Profile", action: "reset" },
    ];

    const handleQuickAction = async (action: string) => {
        const response = await fetch("/api/godmode", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action }),
        });

        if (response.ok) {
            window.location.reload();
        }
    };

    return (
        <>
            {/* Floating God Mode Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-4 right-4 z-50 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded-full shadow-lg hover:shadow-xl transition-all font-bold text-sm flex items-center gap-2"
            >
                ⚡ God Mode
            </button>

            {/* God Mode Panel */}
            {isOpen && (
                <div className="fixed bottom-16 right-4 z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 w-80 overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-3">
                        <div className="text-white font-bold">⚡ God Mode Active</div>
                        <div className="text-purple-200 text-sm">{userName}</div>
                    </div>

                    {/* Role Switcher */}
                    <div className="p-4 border-b">
                        <div className="text-xs text-gray-500 uppercase font-bold mb-2">Switch Role</div>
                        <div className="space-y-2">
                            {roles.map((role) => (
                                <Link
                                    key={role.key}
                                    href={role.href}
                                    className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${currentRole === role.key
                                            ? "bg-purple-100 text-purple-700"
                                            : "hover:bg-gray-100 text-gray-700"
                                        }`}
                                >
                                    {role.label}
                                    {currentRole === role.key && " ✓"}
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="p-4">
                        <div className="text-xs text-gray-500 uppercase font-bold mb-2">Quick Actions</div>
                        <div className="grid grid-cols-2 gap-2">
                            {quickActions.map((qa) => (
                                <button
                                    key={qa.action}
                                    onClick={() => handleQuickAction(qa.action)}
                                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium text-gray-700 transition-colors"
                                >
                                    {qa.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Close */}
                    <button
                        onClick={() => setIsOpen(false)}
                        className="w-full py-2 text-center text-gray-400 hover:text-gray-600 text-sm border-t"
                    >
                        Close
                    </button>
                </div>
            )}
        </>
    );
}
