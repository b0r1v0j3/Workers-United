"use client";

import { useState, useEffect } from "react";
import { Zap, User, Briefcase, Shield, X, ChevronRight } from "lucide-react";

interface GodModePanelProps {
    currentRole: "worker" | "employer" | "admin";
    userName: string;
}

export function GodModePanel({ currentRole, userName }: GodModePanelProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [mounted, setMounted] = useState(false);

    // Prevent hydration mismatch by mounting only on client
    useEffect(() => {
        setMounted(true);
    }, []);

    const roleConfig = {
        admin: { label: "Admin", icon: Shield, color: "text-red-600", bg: "bg-red-50", border: "border-red-200", ring: "ring-red-500/10" },
        employer: { label: "Employer", icon: Briefcase, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200", ring: "ring-blue-500/10" },
        candidate: { label: "Worker", icon: User, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", ring: "ring-emerald-500/10" },
    };

    const current = roleConfig[currentRole as keyof typeof roleConfig] || roleConfig.candidate;

    const handleRoleSwitch = async (action: string) => {
        setLoading(true);
        try {
            const response = await fetch("/api/godmode", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action }),
            });

            if (response.ok) {
                const target = action === "switch_to_employer" ? "/profile/employer" :
                    action === "switch_to_admin" ? "/admin" : "/profile/worker";
                window.location.href = target;
            }
        } finally {
            setLoading(false);
        }
    };

    if (!mounted) return null;

    return (
        <div className="fixed bottom-3 right-3 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end gap-3 sm:gap-4 pointer-events-none font-sans">

            {/* Main Panel (Popover) */}
            {isOpen && (
                <div className="w-[250px] sm:w-[280px] bg-white border border-slate-200 shadow-xl shadow-slate-200/50 rounded-2xl overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-200 origin-bottom-right pointer-events-auto ring-1 ring-slate-900/5">

                    {/* Header */}
                    <div className="bg-slate-50/80 p-3 sm:p-4 border-b border-slate-100 flex justify-between items-center backdrop-blur-sm">
                        <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-lg ${current.bg} ring-1 ring-inset ${current.ring}`}>
                                <Zap size={14} className={`${current.color} fill-current`} />
                            </div>
                            <div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-0.5">God Mode</div>
                                <div className="font-bold text-slate-800 text-xs sm:text-sm leading-none truncate max-w-[140px] sm:max-w-none">{userName}</div>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-all p-1.5 rounded-full"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-2.5 sm:p-3 bg-white">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 pl-1">Switch Perspective</div>
                        <div className="grid grid-cols-1 gap-1.5 sm:gap-2">
                            {currentRole !== "admin" && (
                                <ActionButton
                                    icon={Shield}
                                    label="Switch to Admin"
                                    onClick={() => handleRoleSwitch("switch_to_admin")}
                                    loading={loading}
                                    activeColor="text-red-700 hover:bg-red-50 hover:border-red-100"
                                />
                            )}
                            {currentRole !== "employer" && (
                                <ActionButton
                                    icon={Briefcase}
                                    label="Switch to Employer"
                                    onClick={() => handleRoleSwitch("switch_to_employer")}
                                    loading={loading}
                                    activeColor="text-blue-700 hover:bg-blue-50 hover:border-blue-100"
                                />
                            )}
                            {currentRole !== "worker" && (
                                <ActionButton
                                    icon={User}
                                    label="Switch to Worker"
                                    onClick={() => handleRoleSwitch("switch_to_candidate")}
                                    loading={loading}
                                    activeColor="text-emerald-700 hover:bg-emerald-50 hover:border-emerald-100"
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Trigger Button — compact on mobile */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="group pointer-events-auto flex items-center gap-1.5 sm:gap-2.5 bg-white border border-slate-200 text-slate-700 pl-2.5 pr-3 py-2 sm:pl-3 sm:pr-4 sm:py-2.5 rounded-full shadow-lg shadow-slate-200/50 transition-all hover:bg-slate-50 hover:shadow-xl hover:-translate-y-0.5 ring-1 ring-slate-900/5"
                >
                    <div className={`p-1 sm:p-1.5 rounded-full ${current.bg} ${current.ring} ${loading ? 'animate-spin' : ''}`}>
                        <Zap size={14} className={`${current.color} fill-current sm:w-4 sm:h-4`} />
                    </div>
                    <span className="font-bold text-[10px] sm:text-xs tracking-wide text-slate-800">
                        {current.label}
                    </span>
                </button>
            )}
        </div>
    );
}

function ActionButton({ icon: Icon, label, onClick, loading, activeColor }: any) {
    return (
        <button
            onClick={onClick}
            disabled={loading}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-white text-slate-600 transition-all border border-slate-100 shadow-sm hover:shadow-md ${activeColor}`}
        >
            <div className="flex items-center gap-2.5">
                <Icon size={16} className="opacity-70 group-hover:opacity-100 transition-opacity" />
                <span className="text-sm font-semibold">{label}</span>
            </div>
            <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-400 transition-colors" />
        </button>
    );
}
