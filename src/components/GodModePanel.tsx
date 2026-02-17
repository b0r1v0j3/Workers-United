"use client";

import { useState } from "react";
import { Zap, User, Briefcase, Shield, X, ChevronRight, LayoutDashboard, Copy, Check, Terminal } from "lucide-react";

interface GodModePanelProps {
    currentRole: "worker" | "employer" | "admin";
    userName: string;
}

export function GodModePanel({ currentRole, userName }: GodModePanelProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    const roleConfig = {
        admin: { label: "Admin", icon: Shield, color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20" },
        employer: { label: "Employer", icon: Briefcase, color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20" },
        candidate: { label: "Worker", icon: User, color: "text-green-500", bg: "bg-green-500/10", border: "border-green-500/20" },
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

    const copyUserId = () => {
        // Mock ID for now, in real app pass accurate ID
        const mockId = "usr_" + Math.random().toString(36).substr(2, 9);
        navigator.clipboard.writeText(mockId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">

            {/* Main Panel (Popover) */}
            {isOpen && (
                <div className="w-[300px] bg-gray-900/95 backdrop-blur-md border border-white/10 shadow-2xl rounded-2xl overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-200 origin-bottom-right">

                    {/* Header */}
                    <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-4 relative overflow-hidden">
                        <div className="flex justify-between items-start relative z-10">
                            <div>
                                <div className="flex items-center gap-1.5 text-white/90 mb-1">
                                    <Zap size={14} className="text-yellow-400 fill-yellow-400" />
                                    <span className="text-xs font-bold tracking-wider uppercase">God Mode Active</span>
                                </div>
                                <div className="font-bold text-white text-lg leading-tight">{userName}</div>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-white/70 hover:text-white transition-colors bg-white/10 p-1 rounded-full"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-3 space-y-4">

                        {/* System Info */}
                        <div className="bg-black/40 rounded-lg p-2.5 border border-white/5">
                            <div className="flex items-center justify-between gap-3 mb-2">
                                <div className="flex items-center gap-2">
                                    <div className={`p-1.5 rounded-md ${current.bg}`}>
                                        <current.icon size={14} className={current.color} />
                                    </div>
                                    <div className="text-xs font-medium text-gray-300">
                                        Current Role: <span className="text-white font-semibold">{current.label}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-between gap-2 pl-1">
                                <span className="text-[10px] font-mono text-gray-500">ID: usr_...8x92</span>
                                <button
                                    onClick={copyUserId}
                                    className="flex items-center gap-1.5 text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
                                >
                                    {copied ? <Check size={10} /> : <Copy size={10} />}
                                    {copied ? "Copied" : "Copy ID"}
                                </button>
                            </div>
                        </div>

                        {/* Actions */}
                        <div>
                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 px-1">Switch View</div>
                            <div className="grid grid-cols-1 gap-1">
                                {currentRole !== "admin" && (
                                    <ActionButton
                                        icon={Shield}
                                        label="Switch to Admin"
                                        onClick={() => handleRoleSwitch("switch_to_admin")}
                                        loading={loading}
                                    />
                                )}
                                {currentRole !== "employer" && (
                                    <ActionButton
                                        icon={Briefcase}
                                        label="Switch to Employer"
                                        onClick={() => handleRoleSwitch("switch_to_employer")}
                                        loading={loading}
                                    />
                                )}
                                {currentRole !== "worker" && (
                                    <ActionButton
                                        icon={User}
                                        label="Switch to Worker"
                                        onClick={() => handleRoleSwitch("switch_to_candidate")}
                                        loading={loading}
                                    />
                                )}
                            </div>
                        </div>

                        {/* Quick Nav */}
                        <div className="pt-2 border-t border-white/5">
                            <div className="grid grid-cols-3 gap-1">
                                <NavButton href="/admin" icon={LayoutDashboard} label="Dashboard" />
                                <NavButton href="/api/auth/signout" icon={Terminal} label="Logs" /> {/* Changed for demo utility */}
                                <NavButton href="/" icon={Zap} label="Landing" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Trigger Button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="group flex items-center gap-2 bg-gray-900 border border-white/10 hover:border-indigo-500/50 text-white pl-3 pr-4 py-2.5 rounded-full shadow-2xl transition-all hover:scale-105 active:scale-95"
                >
                    <div className={`p-1 rounded-full bg-indigo-500/20 ${loading ? 'animate-spin' : ''}`}>
                        <Zap size={16} className="text-indigo-400 fill-indigo-400" />
                    </div>
                    <div className="flex flex-col items-start leading-none">
                        <span className="font-bold text-xs tracking-wide">GOD MODE</span>
                        <span className={`text-[9px] font-medium ${current.color} opacity-90`}>{current.label}</span>
                    </div>
                </button>
            )}
        </div>
    );
}

function ActionButton({ icon: Icon, label, onClick, loading }: any) {
    return (
        <button
            onClick={onClick}
            disabled={loading}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-gray-300 hover:text-white transition-colors text-xs font-medium text-left border border-transparent hover:border-white/5"
        >
            <Icon size={14} className="opacity-70" />
            {label}
        </button>
    );
}

function NavButton({ href, icon: Icon, label }: any) {
    return (
        <a
            href={href}
            className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors border border-transparent hover:border-white/5"
        >
            <Icon size={14} />
            <span className="text-[9px] font-medium">{label}</span>
        </a>
    );
}
