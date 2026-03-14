"use client";

import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import { usePathname } from "next/navigation";
import { Briefcase, Building2, ChevronRight, Shield, User, X, Zap } from "lucide-react";

type PanelRole = "worker" | "employer" | "agency" | "admin";

interface PersonaOption {
    id: string;
    role: "worker" | "employer" | "agency";
    label: string;
    href: string;
}

interface GodModePanelProps {
    currentRole: PanelRole;
    userName: string;
    activeLabel?: string | null;
    personas: PersonaOption[];
}

const ROLE_CONFIG = {
    admin: { label: "Admin", icon: Shield, color: "text-red-600", bg: "bg-red-50", ring: "ring-red-500/10", actionClass: "text-red-700 hover:bg-red-50 hover:border-red-100" },
    employer: { label: "Employer", icon: Briefcase, color: "text-blue-600", bg: "bg-blue-50", ring: "ring-blue-500/10", actionClass: "text-blue-700 hover:bg-blue-50 hover:border-blue-100" },
    agency: { label: "Agency", icon: Building2, color: "text-amber-600", bg: "bg-amber-50", ring: "ring-amber-500/10", actionClass: "text-amber-700 hover:bg-amber-50 hover:border-amber-100" },
    worker: { label: "Worker", icon: User, color: "text-emerald-600", bg: "bg-emerald-50", ring: "ring-emerald-500/10", actionClass: "text-emerald-700 hover:bg-emerald-50 hover:border-emerald-100" },
} as const;

export function GodModePanel({ currentRole, userName, activeLabel = null, personas }: GodModePanelProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [loadingRole, setLoadingRole] = useState<PanelRole | null>(null);
    const [mounted, setMounted] = useState(false);
    const pathname = usePathname();

    useEffect(() => {
        setMounted(true);
    }, []);

    const current = ROLE_CONFIG[currentRole];
    const showPanel = pathname?.startsWith("/profile") || pathname?.startsWith("/admin");

    async function handleSwitch(targetRole: PanelRole) {
        setLoadingRole(targetRole);
        try {
            const response = await fetch("/api/admin/test-personas", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(
                    targetRole === "admin"
                        ? { action: "deactivate" }
                        : { action: "activate", role: targetRole }
                ),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Unable to switch sandbox role.");
            }

            window.location.href = data.href || (targetRole === "admin" ? "/admin" : "/profile");
        } catch (error) {
            console.error("[GodModePanel] Switch failed:", error);
        } finally {
            setLoadingRole(null);
        }
    }

    if (!mounted || !showPanel) return null;

    return (
        <div className="fixed bottom-3 left-3 z-50 flex flex-col items-start gap-3 pointer-events-none font-sans sm:bottom-6 sm:left-6 sm:gap-4">
            {isOpen && (
                <div className="w-[280px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50 ring-1 ring-slate-900/5 pointer-events-auto animate-in slide-in-from-bottom-5 fade-in duration-200 origin-bottom-left sm:w-[320px]">
                    <div className="border-b border-slate-100 bg-slate-50/80 p-3 backdrop-blur-sm sm:p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <div className={`rounded-lg p-1.5 ring-1 ring-inset ${current.bg} ${current.ring}`}>
                                    <Zap size={14} className={`${current.color} fill-current`} />
                                </div>
                                <div>
                                    <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Admin Test Mode</div>
                                    <div className="text-sm font-bold leading-none text-slate-800">{activeLabel || current.label}</div>
                                    <div className="mt-1 max-w-[190px] truncate text-[11px] font-medium text-slate-500 sm:max-w-none">{userName}</div>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-200/50 hover:text-slate-600"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <p className="mt-3 text-xs leading-relaxed text-slate-500">
                            Worker, employer, and agency actions use isolated sandbox data so your live admin account and live marketplace records stay untouched.
                        </p>
                    </div>

                    <div className="bg-white p-3">
                        <div className="mb-2 pl-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Switch Workspace</div>
                        <div className="grid gap-2">
                            {currentRole !== "admin" && (
                                <ActionButton
                                    icon={Shield}
                                    label="Back to Admin"
                                    subtitle="Leave sandbox and return to admin tools."
                                    onClick={() => void handleSwitch("admin")}
                                    loading={loadingRole === "admin"}
                                    activeColor="text-red-700 hover:bg-red-50 hover:border-red-100"
                                />
                            )}

                            {personas.map((persona) => {
                                if (persona.role === currentRole) {
                                    return null;
                                }

                                const config = ROLE_CONFIG[persona.role];
                                return (
                                    <ActionButton
                                        key={persona.id}
                                        icon={config.icon}
                                        label={`Open ${config.label}`}
                                        subtitle={persona.label}
                                        onClick={() => void handleSwitch(persona.role)}
                                        loading={loadingRole === persona.role}
                                        activeColor={config.actionClass}
                                    />
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="group pointer-events-auto flex items-center gap-2 rounded-full border border-slate-200 bg-white py-2 pl-2.5 pr-3 text-slate-700 shadow-lg shadow-slate-200/50 ring-1 ring-slate-900/5 transition-all hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-xl sm:py-2.5 sm:pl-3 sm:pr-4"
                >
                    <div className={`rounded-full p-1 sm:p-1.5 ${current.bg} ${current.ring} ${loadingRole ? "animate-spin" : ""}`}>
                        <Zap size={14} className={`${current.color} fill-current sm:h-4 sm:w-4`} />
                    </div>
                    <span className="text-[10px] font-bold tracking-wide text-slate-800 sm:text-xs">
                        {currentRole === "admin" ? "Admin" : ROLE_CONFIG[currentRole].label}
                    </span>
                </button>
            )}
        </div>
    );
}

function ActionButton({
    icon: Icon,
    label,
    subtitle,
    onClick,
    loading,
    activeColor,
}: {
    icon: ComponentType<{ size?: number; className?: string }>;
    label: string;
    subtitle: string;
    onClick: () => void;
    loading: boolean;
    activeColor: string;
}) {
    return (
        <button
            onClick={onClick}
            disabled={loading}
            className={`w-full rounded-xl border border-slate-100 bg-white px-3 py-3 text-left text-slate-600 shadow-sm transition-all hover:shadow-md ${activeColor}`}
        >
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                    <Icon size={16} className="mt-0.5 shrink-0 opacity-70" />
                    <div>
                        <div className="text-sm font-semibold">{label}</div>
                        <div className="mt-0.5 text-xs text-slate-400">{subtitle}</div>
                    </div>
                </div>
                <ChevronRight size={14} className="shrink-0 text-slate-300" />
            </div>
        </button>
    );
}
