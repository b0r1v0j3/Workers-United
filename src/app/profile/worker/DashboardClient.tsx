"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import DocumentWizard from "@/components/DocumentWizard";
import UnifiedNavbar from "@/components/UnifiedNavbar";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import {
    FileText,
    Briefcase,
    MapPin,
    Globe,
    Clock,
    Pencil,
    CheckCircle2,
    AlertCircle,
    Loader2,
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
    adminApproved: boolean;
}

type TabType = "profile" | "documents" | "status";

export default function DashboardClient({
    user, profile, candidate, documents = [], pendingOffers = [], profileCompletion, isReady, inQueue, adminApproved
}: DashboardClientProps) {
    const [activeTab, setActiveTab] = useState<TabType>("profile");
    const [payLoading, setPayLoading] = useState(false);

    async function handlePay() {
        setPayLoading(true);
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
                className="shrink-0 bg-gray-900 text-white font-medium text-sm px-6 py-2.5 rounded-lg shadow-sm whitespace-nowrap inline-flex items-center gap-2 hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
                {payLoading ? (
                    <><Loader2 size={16} className="animate-spin" /> Processing...</>
                ) : (
                    <><CreditCard size={16} /> Start Searching — $9</>
                )}
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
    const hasUploadedDocs = documents && documents.length > 0;
    const docsVerified = documents.filter(d => d.status === 'verified').length >= 3;

    // Application stages
    const stages = [
        { label: "Profile Created", done: true, description: "Your basic information is saved securely." },
        { label: "Documents Uploaded", done: hasUploadedDocs, description: "Provide passport, photo, and diploma." },
        { label: "Payment", done: candidate?.entry_fee_paid || inQueue, description: "Join the active candidate queue." },
        { label: "Documents Verified", done: docsVerified, description: "Admin reviewed and approved documents." },
        { label: "Matched", done: false, description: "Employer sends a job offer." },
    ];

    const hasPendingOffer = pendingOffers && pendingOffers.length > 0;

    return (
        <div className="min-h-screen bg-[#FAFAFA] text-gray-900">
            <UnifiedNavbar variant="dashboard" user={user} profileName={displayName} />

            {/* MAIN CONTENT */}
            <div className="max-w-5xl mx-auto px-4 py-8">


                {/* Start Searching / Queue CTA */}
                <div className="mb-8 bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-gray-200 overflow-hidden">
                    <div className="p-6 relative transition-all duration-300">

                        {/* Top Content (Rocket + Text + Button) */}
                        <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6">
                            <div className="flex items-center gap-5 sm:gap-6">
                                <Image src="/rocket-icon.png" alt="Rocket" width={72} height={72} className="object-contain shrink-0 drop-shadow-sm hover:-translate-y-1 transition-transform duration-300" />
                                <div>
                                    <h3 className="font-semibold text-gray-900 text-lg tracking-tight">
                                        {inQueue ? "You're in the Queue!"
                                            : candidate?.entry_fee_paid ? "You're in the Queue!"
                                                : "Start Searching for Jobs"}
                                    </h3>
                                    <p className="text-gray-500 text-sm mt-1 leading-relaxed max-w-xl">
                                        {inQueue
                                            ? "We're actively looking for the best job match for you."
                                            : candidate?.entry_fee_paid
                                                ? "We're actively looking for the best job match for you."
                                                : "Pay a one-time $9 fee to join our active candidate queue. We'll find you a job in Europe."
                                        }
                                    </p>
                                </div>
                            </div>
                            {inQueue || candidate?.entry_fee_paid ? (
                                <Link href="/profile/worker/queue" className="shrink-0 bg-white text-gray-900 font-medium text-sm px-5 py-2.5 rounded-lg border border-gray-200 shadow-sm whitespace-nowrap inline-block hover:bg-gray-50 transition-colors">
                                    View Queue Status
                                </Link>
                            ) : (
                                <PayButton />
                            )}
                        </div>

                        {/* Bottom Content (Guarantee) */}
                        {!candidate?.entry_fee_paid && !inQueue && (
                            <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-center gap-2 text-gray-500 text-xs font-medium">
                                <Shield size={14} className="text-gray-400" />
                                <span>100% money-back guarantee if no job offer in 90 days</span>
                            </div>
                        )}
                    </div>
                </div>
                {/* TABS Navigation */}
                <div className="flex flex-col md:flex-row gap-6">
                    {/* Sidebar Tabs (Desktop) / Top Tabs (Mobile) */}
                    <div className="md:w-64 flex-shrink-0 space-y-2">
                        <div className="bg-white rounded-xl p-2 shadow-sm border border-gray-200 sticky top-24">
                            <TabButton label="Profile Info" icon={<User size={18} />} active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} />
                            <TabButton label="Documents" icon={<FileText size={18} />} active={activeTab === 'documents'} onClick={() => setActiveTab('documents')} />
                            <TabButton label="Application Status" icon={<Rocket size={18} />} active={activeTab === 'status'} onClick={() => setActiveTab('status')} />

                            <div className="my-2 border-t border-gray-100"></div>

                            <Link href="/profile/worker/edit" className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 font-medium hover:bg-gray-50 transition-colors w-full text-left">
                                <Pencil size={18} /> Edit Profile
                            </Link>
                        </div>
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 min-w-0">
                        {/* ====================== PROFILE INFO TAB ====================== */}
                        {activeTab === 'profile' && (
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
                        )}

                        {/* ====================== DOCUMENTS TAB ====================== */}
                        {activeTab === 'documents' && (
                            <div className="space-y-6">
                                {!isReady && (
                                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                                        <div className="mb-6">
                                            <h3 className="font-semibold text-gray-900 text-xl">Upload Documents</h3>
                                            <p className="text-gray-500 mt-1">Please ensure all documents are clear and readable.</p>
                                        </div>
                                        <DocumentWizard candidateId={user.id} email={user.email || ""} />
                                    </div>
                                )}

                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                                    <h3 className="font-semibold text-gray-900 text-xl mb-6">Document Status</h3>
                                    <div className="space-y-4">
                                        <DocumentRow label="Passport" type="passport" status={getDocStatus("passport")} />
                                        <DocumentRow label="Biometric Photo" type="biometric_photo" status={getDocStatus("biometric_photo")} />
                                        <DocumentRow label="Diploma / Certificate" type="diploma" status={getDocStatus("diploma")} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ====================== STATUS TAB ====================== */}
                        {activeTab === 'status' && (
                            <div className="space-y-6">
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                                    <h3 className="font-semibold text-gray-900 text-xl mb-8">Application Timeline</h3>
                                    <div className="relative">
                                        <div className="absolute left-4 top-4 bottom-4 w-px bg-gray-200" />
                                        {stages.map((stage, index) => (
                                            <div key={stage.label} className="relative flex gap-5 mb-8 last:mb-0">
                                                <div className={`relative z-10 shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300 ${stage.done
                                                    ? 'bg-gray-900 text-white shadow-sm ring-4 ring-white'
                                                    : 'bg-white border border-gray-200 text-gray-400 ring-4 ring-white'
                                                    }`}>
                                                    {stage.done ? <CheckCircle2 size={16} /> : index + 1}
                                                </div>
                                                <div className="pt-1.5 flex flex-col justify-center">
                                                    <h4 className={`font-semibold text-[15px] leading-tight mb-1 transition-colors ${stage.done ? 'text-gray-900' : 'text-gray-500'}`}>{stage.label}</h4>
                                                    <p className={`text-[13px] leading-normal transition-colors ${stage.done ? 'text-gray-500' : 'text-gray-400'}`}>{stage.description}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {hasPendingOffer && (
                                    <div className="bg-gray-50 rounded-xl border border-gray-200 p-8 mt-6">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="bg-white p-2.5 rounded-lg shadow-sm text-gray-700 border border-gray-100">
                                                <Briefcase size={20} />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-gray-900 text-xl">Job Offers</h3>
                                                <p className="text-gray-500">Congratulations! You have pending offers.</p>
                                            </div>
                                        </div>
                                        {pendingOffers.map((offer: any) => (
                                            <Link
                                                key={offer.id}
                                                href={`/profile/worker/offers/${offer.id}`}
                                                className="block bg-white rounded-lg p-5 border border-gray-200 hover:shadow-sm hover:border-gray-300 transition-all group"
                                            >
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <h4 className="font-semibold text-lg text-gray-900 group-hover:text-gray-600 transition-colors">
                                                            {offer.job_request?.employer?.company_name || "Confidential Employer"}
                                                        </h4>
                                                        <p className="text-gray-500">{offer.job_request?.title} • {offer.job_request?.destination_country}</p>
                                                    </div>
                                                    <ChevronRight className="text-slate-300 group-hover:text-emerald-500" />
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── COMPONENTS ──────────────────────────────────────────────

function TabButton({ active, onClick, label, icon }: { active: boolean, onClick: () => void, label: string, icon: React.ReactNode }) {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors mb-0.5 ${active
                ? 'bg-gray-100/80 text-gray-900 border border-gray-200/50'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 border border-transparent'
                }`}
        >
            <span className={active ? 'text-gray-900' : 'text-gray-400'}>{icon}</span>
            {label}
        </button>
    );
}

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
