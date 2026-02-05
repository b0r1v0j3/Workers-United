"use client";

import { useState } from "react";

interface GodModePanelProps {
    currentRole: "candidate" | "employer" | "admin";
    userName: string;
}

export function GodModePanel({ currentRole, userName }: GodModePanelProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const quickActions = [
        { label: "Skip to Verified", action: "verify" },
        { label: "Skip to Queue", action: "queue" },
        { label: "Skip to Offer", action: "offer" },
        { label: "Reset Profile", action: "reset" },
    ];

    const handleRoleSwitch = async (action: string) => {
        setLoading(true);
        try {
            const response = await fetch("/api/godmode", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action }),
            });

            if (response.ok) {
                if (action === "switch_to_employer") {
                    window.location.href = "/profile";
                } else {
                    window.location.href = "/dashboard";
                }
            }
        } finally {
            setLoading(false);
        }
    };

    const handleQuickAction = async (action: string) => {
        setLoading(true);
        try {
            const response = await fetch("/api/godmode", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action }),
            });

            if (response.ok) {
                window.location.reload();
            }
        } finally {
            setLoading(false);
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

                    {/* Switch Role via API */}
                    <div className="p-4 border-b">
                        <div className="text-xs text-gray-500 uppercase font-bold mb-2">Switch User Type</div>
                        <div className="space-y-2">
                            <button
                                onClick={() => handleRoleSwitch("switch_to_candidate")}
                                disabled={loading}
                                className="block w-full text-left px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-100 text-gray-700 disabled:opacity-50"
                            >
                                👤 Switch to Worker
                            </button>
                            <button
                                onClick={() => handleRoleSwitch("switch_to_employer")}
                                disabled={loading}
                                className="block w-full text-left px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-100 text-gray-700 disabled:opacity-50"
                            >
                                🏢 Switch to Employer
                            </button>
                        </div>
                    </div>

                    {/* Direct Navigation (Dev Access) */}
                    <div className="p-4 border-b bg-gray-50">
                        <div className="text-xs text-gray-500 uppercase font-bold mb-2">🔧 Dev Navigation</div>
                        <div className="space-y-2">
                            <a href="/dashboard" className="block px-3 py-2 rounded-lg text-sm font-medium hover:bg-white text-gray-700">
                                📊 Worker Dashboard
                            </a>
                            <a href="/profile" className="block px-3 py-2 rounded-lg text-sm font-medium hover:bg-white text-gray-700">
                                📝 Profile (New UI)
                            </a>
                            <a href="/admin" className="block px-3 py-2 rounded-lg text-sm font-medium hover:bg-white text-gray-700">
                                ⚡ Admin Panel
                            </a>
                            <a href="/onboarding" className="block px-3 py-2 rounded-lg text-sm font-medium hover:bg-white text-gray-700">
                                📋 Onboarding
                            </a>
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
                                    disabled={loading}
                                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium text-gray-700 transition-colors disabled:opacity-50"
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
