"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import {
    Briefcase,
    MapPin,
    Globe,
    Upload,
    ChevronRight,
    Phone,
    User,
    Calendar,
    Shield,
    Users,
    Rocket,
    PartyPopper,
    CreditCard,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Clock,
    FileText,
    Gem
} from "lucide-react";

interface DashboardClientProps {
    user: any;
    profile: any;
    candidate: any;
    documents: any[];
    pendingOffers: any[];
    profileCompletion: number;
    isReady: boolean;
    inQueue: boolean;
}

type TabType = "profile" | "documents" | "status";

export default function DashboardClient({
    user, profile, candidate, documents = [], pendingOffers = [], profileCompletion, isReady, inQueue
}: DashboardClientProps) {
    const [activeTab, setActiveTab] = useState<TabType>("profile");
    const [payLoading, setPayLoading] = useState(false);

    async function handlePay() {
        setPayLoading(true);
        // Track the click
        fetch("/api/track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "payment_click", category: "funnel", details: { type: "entry_fee" } }),
        }).catch(() => { });

        try {
            const res = await fetch('/api/stripe/create-checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'entry_fee' })
            });
            const data = await res.json();
            if (data.checkoutUrl) {
                window.location.href = data.checkoutUrl;
            } else {
                fetch("/api/track", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "payment_error", category: "funnel", details: { error: data.error } }),
                }).catch(() => { });
                toast.error(data.error || 'Payment failed. Please try again.');
            }
        } catch {
            toast.error('Something went wrong. Please try again.');
        } finally {
            setPayLoading(false);
        }
    }

    function PayButton() {
        return (
            <button
                onClick={handlePay}
                disabled={payLoading}
                className="group relative overflow-hidden shrink-0 bg-gradient-to-tr from-[#111111] to-[#2a2a2a] text-white w-full sm:w-[280px] h-[160px] rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] disabled:opacity-75 disabled:hover:translate-y-0 disabled:hover:scale-100 flex flex-col justify-between p-5 text-left border border-[#333333]"
            >
                {/* Glossy overlay effect */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent opacity-50 pointer-events-none" />

                {/* Top row: Chip and Label */}
                <div className="flex justify-between items-start relative z-10">
                    <div className="w-10 h-7 rounded bg-gradient-to-br from-amber-200 to-yellow-500 opacity-90 flex items-center justify-center shadow-inner">
                        <div className="w-full h-[1px] bg-black/20 absolute" />
                        <div className="h-full w-[1px] bg-black/20 absolute" />
                        <Gem size={12} className="text-yellow-900/40 relative z-10" />
                    </div>
                    <span className="text-[10px] uppercase tracking-widest text-white/50 font-semibold">Priority</span>
                </div>

                {/* Middle: Value & Status */}
                <div className="relative z-10 space-y-1 mt-2">
                    {payLoading ? (
                        <div className="flex items-center gap-2 text-white"><Loader2 size={16} className="animate-spin" /><span className="text-sm">Processing...</span></div>
                    ) : (
                        <div className="flex items-center justify-between">
                            <span className="font-mono text-xl tracking-tight font-semibold">Pay $9.00</span>
                            <span className="text-xs bg-white/10 px-2 py-1 rounded-full text-white/90 font-medium group-hover:bg-white/20 transition-colors">Start Search</span>
                        </div>
                    )}
                </div>

                {/* Bottom: Name */}
                <div className="relative z-10 pt-2 border-t border-white/10 flex items-end justify-between">
                    <div className="flex flex-col">
                        <span className="text-[8px] text-white/40 uppercase tracking-wider mb-0.5">Cardholder Name</span>
                        <span className="text-xs font-medium tracking-wide truncate max-w-[180px] text-white/80 uppercase">
                            {displayName.substring(0, 22)}
                        </span>
                    </div>
                    <div className="flex -space-x-1.5 opacity-80">
                        <div className="w-5 h-5 rounded-full bg-red-400 mix-blend-multiply" />
                        <div className="w-5 h-5 rounded-full bg-yellow-400 mix-blend-multiply" />
                    </div>
                </div>

                {/* Decorative background circle */}
                <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-colors duration-500 pointer-events-none" />
            </button>
        );
    }

    useEffect(() => {
        if (profileCompletion === 100 && !sessionStorage.getItem("celebrated_profile")) {
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
            });
            toast.success("Profile 100% Complete!");
            sessionStorage.setItem("celebrated_profile", "true");
        }
    }, [profileCompletion]);

    const getDocStatus = (type: string) => {
        const doc = documents.find(d => d.document_type === type);
        if (!doc) return { status: "missing", label: "Not uploaded", color: "gray", icon: Upload };
        if (doc.status === "verified") return { status: "verified", label: "Verified", color: "emerald", icon: CheckCircle2 };
        if (doc.status === "rejected") return { status: "rejected", label: "Rejected", color: "red", icon: AlertCircle };
        if (doc.status === "verifying") return { status: "verifying", label: "Verifying...", color: "amber", icon: Loader2 };
        return { status: "uploaded", label: "Uploaded", color: "blue", icon: Clock };
    };

    const displayName = profile?.full_name || user.user_metadata?.full_name || "Worker";
    const hasPaidEntryFee = !!candidate?.entry_fee_paid;
    const canStartPayment = !hasPaidEntryFee && !inQueue;
    const paymentPendingActivation = hasPaidEntryFee && !inQueue;
    const hasUploadedDocs = documents && documents.length > 0;
    const docsVerified = documents.filter(d => d.status === 'verified').length >= 3;

    return (
        <div className="w-full space-y-6">
            {/* Start Searching / Queue CTA */}
            <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-gray-200 overflow-hidden">
                <div className="p-6 relative transition-all duration-300">
                    {/* Top Content (Text + Button) */}
                    <div className="relative z-10 flex flex-col items-center justify-center gap-6 text-center">
                        <div className="flex flex-col items-center">
                            <h3 className="font-semibold text-gray-900 text-xl tracking-tight">
                                {inQueue
                                    ? "You're in the Queue!"
                                    : paymentPendingActivation
                                        ? "Payment Received"
                                        : "Start Searching for Jobs"}
                            </h3>
                            <p className="text-gray-500 text-sm mt-2 leading-relaxed max-w-md mx-auto">
                                {inQueue
                                    ? "We're actively looking for the best job match for you."
                                    : paymentPendingActivation
                                        ? "Your payment is confirmed. We're activating your queue status now."
                                        : "Pay a one-time $9 fee to join our active candidate queue. We'll find you a job in Europe."
                                }
                            </p>
                        </div>
                        {inQueue || paymentPendingActivation ? (
                            <Link href="/profile/worker/queue" className="shrink-0 bg-white text-gray-900 font-medium text-sm px-5 py-2.5 rounded-lg border border-gray-200 shadow-sm whitespace-nowrap inline-block hover:bg-gray-50 transition-colors">
                                View Queue Status
                            </Link>
                        ) : (
                            <PayButton />
                        )}
                    </div>

                    {/* Bottom Content (Guarantee) */}
                    {canStartPayment && (
                        <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-center gap-1.5 text-gray-500 text-[11px] sm:text-xs font-medium text-center px-1">
                            <Shield size={14} className="shrink-0 text-gray-400" />
                            <span className="truncate sm:whitespace-nowrap">100% money-back guarantee if no job offer in 90 days</span>
                        </div>
                    )}
                </div>
            </div>

            {/* PROFILE INFO TAB */}
            <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                    <h3 className="font-semibold text-gray-900 text-xl mb-6 flex items-center gap-2">
                        <User className="text-gray-400" /> Personal Information
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <InfoRow icon={<User size={18} />} label="Full Name" value={profile?.full_name || candidate?.profiles?.full_name} />
                        <InfoRow icon={<User size={18} />} label="Gender" value={candidate?.gender} />
                        <InfoRow icon={<Globe size={18} />} label="Nationality" value={candidate?.nationality} />
                        <InfoRow icon={<Users size={18} />} label="Marital Status" value={candidate?.marital_status} />
                        <InfoRow icon={<Calendar size={18} />} label="Date of Birth" value={candidate?.date_of_birth ? new Date(candidate.date_of_birth).toLocaleDateString('en-GB') : null} />
                        <InfoRow icon={<MapPin size={18} />} label="Birth Place" value={candidate?.birth_city && candidate?.birth_country ? `${candidate.birth_city}, ${candidate.birth_country}` : (candidate?.birth_country || null)} />
                        <InfoRow icon={<Globe size={18} />} label="Citizenship" value={candidate?.citizenship} />
                        <InfoRow icon={<Phone size={18} />} label="Phone" value={candidate?.phone} />
                        <InfoRow icon={<MapPin size={18} />} label="Current Location" value={candidate?.current_country} />
                        <InfoRow icon={<Briefcase size={18} />} label="Preferred Job" value={candidate?.preferred_job} />
                    </div>
                </div>

                {/* Passport Information */}
                {candidate?.passport_number && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                        <h3 className="font-semibold text-gray-900 text-xl mb-6 flex items-center gap-2">
                            <Shield className="text-gray-400" /> Passport & Travel
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <InfoRow icon={<FileText size={18} />} label="Passport Number" value={candidate.passport_number ? `***${candidate.passport_number.slice(-4)}` : null} />
                            <InfoRow icon={<Globe size={18} />} label="Issued By" value={candidate.passport_issued_by} />
                            <InfoRow icon={<Calendar size={18} />} label="Issue Date" value={candidate.passport_issue_date ? new Date(candidate.passport_issue_date).toLocaleDateString('en-GB') : null} />
                            <InfoRow icon={<Calendar size={18} />} label="Expiry Date" value={candidate.passport_expiry_date ? new Date(candidate.passport_expiry_date).toLocaleDateString('en-GB') : null} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── COMPONENTS ──────────────────────────────────────────────

function InfoRow({ icon, label, value }: { icon: React.ReactNode, label: string, value: any }) {
    return (
        <div className="group">
            <div className="flex items-center gap-2 mb-1.5">
                <span className="text-gray-400">{icon}</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}</span>
            </div>
            <div className="pl-7 font-medium text-gray-900 text-sm border-b border-transparent group-hover:border-gray-100 pb-1 transition-colors">
                {value || <span className="text-gray-400 italic font-normal">Not provided</span>}
            </div>
        </div>
    );
}

function DocumentRow({ label, type, status }: { label: string, type: string, status: any }) {
    const IconComponent = status.icon;
    const colorMap: Record<string, string> = {
        emerald: "text-emerald-700 bg-emerald-50 border-emerald-100",
        red: "text-red-700 bg-red-50 border-red-100",
        amber: "text-amber-700 bg-amber-50 border-amber-100",
        blue: "text-blue-700 bg-blue-50 border-blue-100",
        gray: "text-gray-600 bg-gray-50 border-gray-200",
    };

    return (
        <div className={`flex items-center justify-between p-4 rounded-xl border transition-all ${colorMap[status.color] || colorMap.gray}`}>
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-white/60 flex items-center justify-center border border-current/10">
                    <FileText size={18} className="opacity-80" />
                </div>
                <div>
                    <h4 className="font-semibold text-sm">{label}</h4>
                    <p className="text-xs opacity-70 font-medium mt-0.5">{type.replace(/_/g, ' ')}</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <span className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded bg-white/60 border border-current/10`}>
                    {status.label}
                </span>
                <IconComponent size={18} className={status.color === 'amber' ? 'animate-spin' : ''} />
            </div>
        </div>
    );
}
