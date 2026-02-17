"use client";

import { useState } from "react";
import { Zap, User, Briefcase, Shield, X, ChevronRight, LayoutDashboard, LogOut } from "lucide-react";

interface GodModePanelProps {
    currentRole: "worker" | "employer" | "admin";
    userName: string;
}

export function GodModePanel({ currentRole, userName }: GodModePanelProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const roleConfig = {
        admin: { label: "Admin", icon: Shield, color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
        employer: { label: "Employer", icon: Briefcase, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
        candidate: { label: "Worker", icon: User, color: "text-green-600", bg: "bg-green-50", border: "border-green-200" },
    };

    // Fallback if role is unknown
    const current = roleConfig[currentRole as keyof typeof roleConfig] || roleConfig.candidate;
    const CurrentIcon = current.icon;

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
            {/* Floating Trigger Button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 z-50 group flex items-center gap-2 bg-black/90 hover:bg-black text-white px-4 py-3 rounded-full shadow-2xl transition-all hover:scale-105 active:scale-95 backdrop-blur-sm"
                >
                    <div className={`p-1 rounded-full bg-white/20 ${loading ? 'animate-spin' : ''}`}>
                        <Zap size={16} className="text-yellow-400 fill-yellow-400" />
                    </div>
                    <span className="font-bold text-sm tracking-wide">God Mode</span>
                    <div className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-white/20 text-white/90`}>
                        {current.label}
                    </div>
                </button>
            )}

            {/* Panel Overlay */}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end sm:p-6 pointer-events-none">
                    {/* Backdrop for mobile */}
                    <div
                        className="absolute inset-0 bg-black/20 backdrop-blur-sm sm:bg-transparent sm:backdrop-blur-none pointer-events-auto transition-opacity"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Main Panel */}
                    <div className="pointer-events-auto w-full sm:w-[320px] bg-white/90 backdrop-blur-xl border border-white/20 shadow-2xl sm:rounded-3xl rounded-t-3xl overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-200">

                        {/* Header */}
                        <div className="relative bg-gradient-to-br from-violet-600 to-indigo-600 p-6 text-white overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Zap size={120} />
                            </div>

                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                                        <Zap size={14} className="text-yellow-300 fill-yellow-300" />
                                        <span className="text-xs font-bold tracking-wider uppercase">God Mode Active</span>
                                    </div>
                                    <button
                                        onClick={() => setIsOpen(false)}
                                        className="p-1 rounded-full hover:bg-white/20 transition-colors"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className={`p-2.5 rounded-xl bg-white text-indigo-600 shadow-lg`}>
                                        <CurrentIcon size={24} />
                                    </div>
                                    <div>
                                        <div className="text-xs text-indigo-200 font-medium mb-0.5">Currently viewing as</div>
                                        <div className="font-bold text-lg leading-tight">{userName}</div>
                                        <div className="text-xs font-medium text-white/80 opacity-90">{current.label}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-4 space-y-6">

                            {/* Role Switcher */}
                            <div>
                                <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3 px-1">Switch Perspective</div>
                                <div className="space-y-2">
                                    {currentRole !== "admin" && (
                                        <RoleButton
                                            icon={Shield}
                                            label="Administrator"
                                            desc="Full system access"
                                            color="text-red-600"
                                            bg="hover:bg-red-50"
                                            onClick={() => handleRoleSwitch("switch_to_admin")}
                                            disabled={loading}
                                        />
                                    )}
                                    {currentRole !== "employer" && (
                                        <RoleButton
                                            icon={Briefcase}
                                            label="Employer"
                                            desc="Manage jobs & candidates"
                                            color="text-blue-600"
                                            bg="hover:bg-blue-50"
                                            onClick={() => handleRoleSwitch("switch_to_employer")}
                                            disabled={loading}
                                        />
                                    )}
                                    {currentRole !== "worker" && (
                                        <RoleButton
                                            icon={User}
                                            label="Worker"
                                            desc="View job offers & profile"
                                            color="text-green-600"
                                            bg="hover:bg-green-50"
                                            onClick={() => handleRoleSwitch("switch_to_candidate")}
                                            disabled={loading}
                                        />
                                    )}
                                </div>
                            </div>

                            {/* Quick Navigation */}
                            <div>
                                <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3 px-1">Quick Jump</div>
                                <div className="grid grid-cols-3 gap-2">
                                    <NavButton href="/admin" label="Admin" icon={LayoutDashboard} />
                                    <NavButton href="/profile/employer" label="Employer" icon={Briefcase} />
                                    <NavButton href="/profile/worker" label="Worker" icon={User} />
                                </div>
                            </div>

                        </div>

                        {/* Footer */}
                        <div className="bg-gray-50 p-3 text-center border-t border-gray-100">
                            <p className="text-[10px] text-gray-400 font-medium">Workers United God Mode v2.0</p>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

function RoleButton({ icon: Icon, label, desc, color, bg, onClick, disabled }: any) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border border-transparent hover:border-gray-200 transition-all duration-200 group text-left ${bg} disabled:opacity-50 disabled:cursor-not-allowed`}
        >
            <div className={`p-2 rounded-lg bg-white shadow-sm ring-1 ring-black/5 group-hover:scale-110 transition-transform ${color}`}>
                <Icon size={18} />
            </div>
            <div className="flex-1">
                <div className="font-semibold text-sm text-gray-900 group-hover:text-black">{label}</div>
                <div className="text-xs text-gray-500 font-medium">{desc}</div>
            </div>
            <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
        </button>
    );
}

function NavButton({ href, label, icon: Icon }: any) {
    return (
        <a
            href={href}
            className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-600 hover:text-gray-900 border border-transparent hover:border-gray-200 transition-all hover:-translate-y-0.5 active:translate-y-0"
        >
            <Icon size={18} />
            <span className="text-xs font-semibold">{label}</span>
        </a>
    );
}
