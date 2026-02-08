"use client";

import { useState } from "react";

interface GodModePanelProps {
    currentRole: "worker" | "employer" | "admin";
    userName: string;
}

export function GodModePanel({ currentRole, userName }: GodModePanelProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const roleLabels: Record<string, { label: string; icon: string; color: string }> = {
        admin: { label: "Admin", icon: "⚡", color: "bg-red-100 text-red-700 border-red-200" },
        employer: { label: "Employer", icon: "🏢", color: "bg-blue-100 text-blue-700 border-blue-200" },
        candidate: { label: "Worker", icon: "👤", color: "bg-green-100 text-green-700 border-green-200" },
    };

    const current = roleLabels[currentRole] || roleLabels.candidate;

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
                    window.location.href = "/profile/employer";
                } else if (action === "switch_to_admin") {
                    window.location.href = "/admin";
                } else {
                    window.location.href = "/profile/worker";
                }
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {/* Floating God Mode Button — shows current role */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed top-[72px] right-3 z-50 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-1.5 rounded-full shadow-lg hover:shadow-xl transition-all font-bold text-xs flex items-center gap-1.5"
            >
                ⚡ God Mode
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-bold ${current.color}`}>
                    {current.label.toUpperCase()}
                </span>
            </button>

            {/* God Mode Panel */}
            {isOpen && (
                <div className="fixed top-[110px] right-3 z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 w-72 overflow-hidden">
                    {/* Header with current role */}
                    <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-3">
                        <div className="text-white font-bold flex items-center gap-2">
                            ⚡ God Mode
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-purple-200 text-sm">{userName}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${current.color}`}>
                                {current.icon} {current.label}
                            </span>
                        </div>
                    </div>

                    {/* Switch Role */}
                    <div className="p-3">
                        <div className="text-[10px] text-gray-400 uppercase font-bold mb-2 tracking-wider">Switch Role</div>
                        <div className="space-y-1">
                            {currentRole !== "admin" && (
                                <RoleButton
                                    label="⚡ Admin"
                                    onClick={() => handleRoleSwitch("switch_to_admin")}
                                    disabled={loading}
                                />
                            )}
                            {currentRole !== "worker" && (
                                <RoleButton
                                    label="👤 Worker"
                                    onClick={() => handleRoleSwitch("switch_to_candidate")}
                                    disabled={loading}
                                />
                            )}
                            {currentRole !== "employer" && (
                                <RoleButton
                                    label="🏢 Employer"
                                    onClick={() => handleRoleSwitch("switch_to_employer")}
                                    disabled={loading}
                                />
                            )}
                        </div>
                    </div>

                    {/* Quick Nav */}
                    <div className="px-3 pb-3 border-t border-gray-100 pt-2">
                        <div className="text-[10px] text-gray-400 uppercase font-bold mb-2 tracking-wider">Quick Nav</div>
                        <div className="grid grid-cols-3 gap-1">
                            <NavButton href="/admin" label="Admin" icon="⚡" />
                            <NavButton href="/profile/worker" label="Worker" icon="👤" />
                            <NavButton href="/profile/employer" label="Employer" icon="🏢" />
                        </div>
                    </div>

                    {/* Close */}
                    <button
                        onClick={() => setIsOpen(false)}
                        className="w-full py-2 text-center text-gray-400 hover:text-gray-600 text-xs border-t"
                    >
                        Close
                    </button>
                </div>
            )}
        </>
    );
}

function RoleButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className="block w-full text-left px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-100 text-gray-700 disabled:opacity-50 transition-colors"
        >
            {label}
        </button>
    );
}

function NavButton({ href, label, icon }: { href: string; label: string; icon: string }) {
    return (
        <a
            href={href}
            className="flex flex-col items-center gap-1 px-2 py-2 rounded-lg text-xs font-medium hover:bg-gray-100 text-gray-600 transition-colors"
        >
            <span className="text-lg">{icon}</span>
            <span>{label}</span>
        </a>
    );
}
