"use client";

import { useState } from "react";
import { Zap, User, Briefcase, Shield, X, LayoutDashboard, Copy, Check, Terminal, ExternalLink, ChevronRight } from "lucide-react";

interface GodModePanelProps {
    currentRole: "worker" | "employer" | "admin";
    userName: string;
}

export function GodModePanel({ currentRole, userName }: GodModePanelProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    const roleConfig = {
        admin: { label: "Admin", icon: Shield, color: "text-red-400", bg: "bg-red-500/20", border: "border-red-500/30" },
        employer: { label: "Employer", icon: Briefcase, color: "text-blue-400", bg: "bg-blue-500/20", border: "border-blue-500/30" },
        candidate: { label: "Worker", icon: User, color: "text-green-400", bg: "bg-green-500/20", border: "border-green-500/30" },
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
        const mockId = "usr_" + Math.random().toString(36).substr(2, 9);
        navigator.clipboard.writeText(mockId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4 pointer-events-none">

            {/* Main Panel (Popover) */}
            {isOpen && (
                <div className="w-[320px] bg-[#1a1b26] border border-gray-700 shadow-2xl rounded-xl overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-200 origin-bottom-right pointer-events-auto ring-1 ring-black/50">

                    {/* Header */}
                    <div className="bg-gradient-to-r from-violet-700 to-indigo-700 p-4 relative">
                        <div className="flex justify-between items-start relative z-10">
                            <div>
                                <div className="flex items-center gap-1.5 text-yellow-300 mb-1">
                                    <Zap size={14} className="fill-yellow-300" />
                                    <span className="text-[10px] font-black tracking-widest uppercase">GOD MODE ACTIVE</span>
                                </div>
                                <div className="font-bold text-white text-lg leading-tight drop-shadow-sm">{userName}</div>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-white/80 hover:text-white hover:bg-white/20 transition-all p-1.5 rounded-full"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-4 space-y-5 bg-[#1a1b26]">

                        {/* System Info */}
                        <div className="bg-black/30 rounded-lg p-3 border border-white/5 mx-[-4px]">
                            <div className="flex items-center justify-between gap-3 mb-2">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${current.bg} ring-1 ring-inset ${current.border}`}>
                                        <current.icon size={16} className={current.color} />
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Current Role</div>
                                        <div className={`font-bold text-sm ${current.color}`}>{current.label}</div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-between gap-2 pl-1 border-t border-white/5 pt-2 mt-2">
                                <span className="text-[10px] font-mono text-gray-400">ID: usr_...8x92</span>
                                <button
                                    onClick={copyUserId}
                                    className="flex items-center gap-1.5 text-[10px] bg-white/5 hover:bg-white/10 px-2 py-1 rounded text-indigo-300 transition-colors"
                                >
                                    {copied ? <Check size={10} /> : <Copy size={10} />}
                                    {copied ? "Copied" : "Copy ID"}
                                </button>
                            </div>
                        </div>

                        {/* Actions */}
                        <div>
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">Switch Perspective</div>
                            <div className="grid grid-cols-1 gap-2">
                                {currentRole !== "admin" && (
                                    <ActionButton
                                        icon={Shield}
                                        label="Switch to Admin"
                                        onClick={() => handleRoleSwitch("switch_to_admin")}
                                        loading={loading}
                                        color="text-red-400"
                                    />
                                )}
                                {currentRole !== "employer" && (
                                    <ActionButton
                                        icon={Briefcase}
                                        label="Switch to Employer"
                                        onClick={() => handleRoleSwitch("switch_to_employer")}
                                        loading={loading}
                                        color="text-blue-400"
                                    />
                                )}
                                {currentRole !== "worker" && (
                                    <ActionButton
                                        icon={User}
                                        label="Switch to Worker"
                                        onClick={() => handleRoleSwitch("switch_to_candidate")}
                                        loading={loading}
                                        color="text-green-400"
                                    />
                                )}
                            </div>
                        </div>

                        {/* Quick Nav */}
                        <div className="pt-4 border-t border-gray-800">
                            <div className="grid grid-cols-3 gap-2">
                                <NavButton href="/admin" icon={LayoutDashboard} label="Dashboard" />
                                <NavButton href="/api/auth/signout" icon={Terminal} label="Logs" />
                                <NavButton href="/" icon={ExternalLink} label="Landing" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Trigger Button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="group pointer-events-auto flex items-center gap-3 bg-gray-900 border border-gray-700 hover:border-indigo-500 text-white pl-4 pr-5 py-3 rounded-full shadow-2xl transition-all hover:-translate-y-1 hover:shadow-indigo-500/20"
                >
                    <div className={`p-1.5 rounded-full bg-indigo-500/20 ${loading ? 'animate-spin' : ''}`}>
                        <Zap size={18} className="text-indigo-400 fill-indigo-400" />
                    </div>
                    <div className="flex flex-col items-start leading-none gap-0.5">
                        <span className="font-black text-xs tracking-wide">GOD MODE</span>
                        <span className={`text-[10px] font-bold ${current.color} opacity-90`}>{current.label}</span>
                    </div>
                </button>
            )}
        </div>
    );
}

function ActionButton({ icon: Icon, label, onClick, loading, color }: any) {
    return (
        <button
            onClick={onClick}
            disabled={loading}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-gray-800/50 hover:bg-gray-800 text-gray-200 hover:text-white transition-all border border-gray-700/50 hover:border-gray-600 group"
        >
            <div className="flex items-center gap-3">
                <Icon size={16} className={`opacity-70 group-hover:opacity-100 transition-opacity ${color}`} />
                <span className="text-sm font-medium">{label}</span>
            </div>
            <ChevronRight size={14} className="text-gray-600 group-hover:text-gray-400 transition-colors" />
        </button>
    );
}

function NavButton({ href, icon: Icon, label }: any) {
    return (
        <a
            href={href}
            className="flex flex-col items-center justify-center gap-2 p-2.5 rounded-xl bg-gray-800/30 hover:bg-gray-800 text-gray-400 hover:text-white transition-all border border-transparent hover:border-gray-700"
        >
            <Icon size={16} />
            <span className="text-[10px] font-semibold">{label}</span>
        </a>
    );
}
