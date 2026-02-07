"use client";

import { useState } from "react";
import Link from "next/link";
import DocumentWizard from "@/components/DocumentWizard";
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
    Shield
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

    const getDocStatus = (type: string) => {
        const doc = documents.find(d => d.document_type === type);
        if (!doc) return { status: "missing", label: "Not uploaded", color: "slate", icon: Upload };
        if (doc.status === "verified") return { status: "verified", label: "Verified", color: "emerald", icon: CheckCircle2 };
        if (doc.status === "rejected") return { status: "rejected", label: "Rejected", color: "red", icon: AlertCircle };
        if (doc.status === "verifying") return { status: "verifying", label: "Verifying...", color: "amber", icon: Loader2 };
        return { status: "uploaded", label: "Uploaded", color: "blue", icon: Clock };
    };

    const displayName = profile?.full_name || user.user_metadata?.full_name || "Worker";

    // Application stages
    const stages = [
        { label: "Profile Created", done: true },
        { label: "Documents Uploaded", done: isReady },
        { label: "Verified", done: inQueue },
        { label: "In Queue", done: inQueue },
        { label: "Matched", done: false },
    ];

    const hasPendingOffer = pendingOffers && pendingOffers.length > 0;

    return (
        <div className="min-h-screen bg-[#f0f2f5]">
            {/* NAVBAR */}
            <nav className="bg-white shadow-sm sticky top-0 z-50 border-b border-[#dddfe2] h-[56px]">
                <div className="max-w-[1100px] mx-auto px-4 h-full flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
                        <img src="/logo.png" alt="Workers United" className="h-20 w-auto object-contain" />
                        <span className="font-bold text-[#1877f2] text-xl hidden sm:inline tracking-tight">
                            Workers United
                        </span>
                    </Link>
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-[#050505] hidden sm:block">
                            {user.email?.split('@')[0]}
                        </span>
                        <a
                            href="/auth/signout"
                            className="w-9 h-9 bg-[#f0f2f5] rounded-full flex items-center justify-center text-[#050505] hover:bg-[#e4e6eb] transition-colors"
                            title="Logout"
                        >
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                                <path d="M16 13v-2H7V8l-5 4 5 4v-3z" />
                                <path d="M20 3h-9c-1.103 0-2 .897-2 2v4h2V5h9v14h-9v-4H9v4c0 1.103.897 2 2 2h9c1.103 0 2-.897 2-2V5c0-1.103-.897-2-2-2z" />
                            </svg>
                        </a>
                    </div>
                </div>
            </nav>

            {/* MAIN CONTENT */}
            <div className="max-w-[900px] mx-auto px-4 py-6">

                {/* PROFILE CARD */}
                <div className="bg-white rounded-xl shadow-sm border border-[#dddfe2] overflow-hidden mb-4">
                    {/* Header gradient strip */}
                    <div className="h-[120px] bg-gradient-to-r from-[#1877f2] via-[#42a5f5] to-[#1565c0] relative">
                        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white/20 to-transparent" />
                    </div>

                    <div className="px-6 pb-4 -mt-8 relative">
                        {/* Avatar */}
                        <div className="w-[80px] h-[80px] rounded-full bg-white border-4 border-white shadow-lg flex items-center justify-center overflow-hidden mb-3">
                            <img
                                src={user.user_metadata?.avatar_url || "/logo.png"}
                                alt={displayName}
                                className="w-full h-full object-cover"
                                onError={(e) => { e.currentTarget.src = "/logo.png"; }}
                            />
                        </div>

                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
                            <div>
                                <h1 className="text-2xl font-bold text-[#050505] leading-tight">{displayName}</h1>
                                <p className="text-[#65676b] text-sm mt-0.5">
                                    {candidate?.preferred_job || "Worker"} • {candidate?.nationality || "International"}
                                </p>
                            </div>
                            <Link
                                href="/profile/worker/edit"
                                className="bg-[#1877f2] text-white px-5 py-2 rounded-lg font-semibold text-sm hover:bg-[#166fe5] transition-colors flex items-center gap-2 shadow-sm"
                            >
                                <Pencil size={16} /> Edit Profile
                            </Link>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-t border-[#dddfe2] px-2">
                        <TabButton label="Profile Info" active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} />
                        <TabButton label="Documents" active={activeTab === 'documents'} onClick={() => setActiveTab('documents')} />
                        <TabButton label="Status" active={activeTab === 'status'} onClick={() => setActiveTab('status')} />
                    </div>
                </div>

                {/* ====================== PROFILE INFO TAB ====================== */}
                {activeTab === 'profile' && (
                    <div className="space-y-4">
                        {/* Profile Completion */}
                        <div className="bg-white rounded-xl shadow-sm border border-[#dddfe2] p-5">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-bold text-[#050505]">Profile Completion</h3>
                                <span className={`text-sm font-bold ${profileCompletion === 100 ? 'text-emerald-600' : 'text-[#1877f2]'}`}>
                                    {profileCompletion}%
                                </span>
                            </div>
                            <div className="h-2.5 bg-[#f0f2f5] rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${profileCompletion === 100 ? 'bg-emerald-500' : 'bg-[#1877f2]'}`}
                                    style={{ width: `${profileCompletion}%` }}
                                />
                            </div>
                            {profileCompletion < 100 && (
                                <p className="text-xs text-[#65676b] mt-2">
                                    Complete your profile to get matched with employers faster.
                                </p>
                            )}
                        </div>

                        {/* Personal Information */}
                        <div className="bg-white rounded-xl shadow-sm border border-[#dddfe2] p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-[#050505] text-lg">Personal Information</h3>
                                <Link href="/profile/worker/edit" className="text-[#1877f2] text-sm font-semibold hover:underline">
                                    Edit
                                </Link>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <InfoRow icon={<User size={18} />} label="Full Name" value={profile?.full_name || candidate?.profiles?.full_name} />
                                <InfoRow icon={<Globe size={18} />} label="Nationality" value={candidate?.nationality} />
                                <InfoRow icon={<MapPin size={18} />} label="Current Location" value={candidate?.current_country} />
                                <InfoRow icon={<Calendar size={18} />} label="Date of Birth" value={candidate?.date_of_birth ? new Date(candidate.date_of_birth).toLocaleDateString() : null} />
                                <InfoRow icon={<Phone size={18} />} label="Phone" value={candidate?.phone} />
                                <InfoRow icon={<Briefcase size={18} />} label="Preferred Job" value={candidate?.preferred_job} />
                            </div>
                        </div>

                        {/* Pending Offers */}
                        {hasPendingOffer && (
                            <div className="bg-gradient-to-r from-emerald-50 to-blue-50 rounded-xl shadow-sm border border-emerald-200 p-5">
                                <h3 className="font-bold text-emerald-800 text-lg mb-3 flex items-center gap-2">
                                    🎉 You have a job offer!
                                </h3>
                                {pendingOffers.map((offer: any) => (
                                    <Link
                                        key={offer.id}
                                        href={`/profile/worker/offers/${offer.id}`}
                                        className="flex items-center justify-between p-3 bg-white rounded-lg border border-emerald-200 hover:border-emerald-400 transition-colors group"
                                    >
                                        <div>
                                            <div className="font-bold text-[#050505]">{offer.job_request?.employer?.company_name || "Company"}</div>
                                            <div className="text-sm text-[#65676b]">{offer.job_request?.destination_country}</div>
                                        </div>
                                        <ChevronRight size={20} className="text-[#65676b] group-hover:text-emerald-600 transition-colors" />
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ====================== DOCUMENTS TAB ====================== */}
                {activeTab === 'documents' && (
                    <div className="space-y-4">
                        {/* Document Upload Wizard (if not ready) */}
                        {!isReady && (
                            <div className="bg-white rounded-xl shadow-sm border border-[#dddfe2] p-5">
                                <h3 className="font-bold text-[#050505] text-lg mb-2">Upload Documents</h3>
                                <p className="text-sm text-[#65676b] mb-4">
                                    Upload your documents below to begin the verification process.
                                </p>
                                <DocumentWizard candidateId={user.id} email={user.email || ""} />
                            </div>
                        )}

                        {/* Document Status List */}
                        <div className="bg-white rounded-xl shadow-sm border border-[#dddfe2] p-5">
                            <h3 className="font-bold text-[#050505] text-lg mb-4">Document Status</h3>
                            <div className="space-y-3">
                                <DocumentRow label="Passport" type="passport" status={getDocStatus("passport")} />
                                <DocumentRow label="Biometric Photo" type="biometric_photo" status={getDocStatus("biometric_photo")} />
                                <DocumentRow label="Diploma / Certificate" type="diploma" status={getDocStatus("diploma")} />
                            </div>
                        </div>
                    </div>
                )}

                {/* ====================== STATUS TAB ====================== */}
                {activeTab === 'status' && (
                    <div className="space-y-4">
                        {/* Progress Tracker */}
                        <div className="bg-white rounded-xl shadow-sm border border-[#dddfe2] p-6">
                            <h3 className="font-bold text-[#050505] text-lg mb-6">Application Progress</h3>
                            <div className="relative">
                                {stages.map((stage, index) => (
                                    <div key={stage.label} className="flex items-start gap-4 mb-6 last:mb-0">
                                        {/* Dot + Line */}
                                        <div className="flex flex-col items-center">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 shrink-0 transition-colors ${stage.done
                                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                                : 'bg-white border-[#dddfe2] text-[#65676b]'
                                                }`}>
                                                {stage.done ? <CheckCircle2 size={16} /> : <span className="text-xs font-bold">{index + 1}</span>}
                                            </div>
                                            {index < stages.length - 1 && (
                                                <div className={`w-0.5 h-8 mt-1 ${stage.done ? 'bg-emerald-300' : 'bg-[#dddfe2]'}`} />
                                            )}
                                        </div>
                                        {/* Label */}
                                        <div className="pt-1">
                                            <span className={`font-semibold text-sm ${stage.done ? 'text-emerald-700' : 'text-[#65676b]'}`}>
                                                {stage.label}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Current Status Card */}
                        <div className={`rounded-xl shadow-sm border p-5 ${inQueue
                            ? 'bg-emerald-50 border-emerald-200'
                            : isReady
                                ? 'bg-blue-50 border-blue-200'
                                : 'bg-amber-50 border-amber-200'
                            }`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${inQueue ? 'bg-emerald-500' : isReady ? 'bg-[#1877f2]' : 'bg-amber-500'
                                    } text-white`}>
                                    {inQueue ? <CheckCircle2 size={20} /> : isReady ? <Clock size={20} /> : <AlertCircle size={20} />}
                                </div>
                                <div>
                                    <h4 className={`font-bold ${inQueue ? 'text-emerald-800' : isReady ? 'text-blue-800' : 'text-amber-800'
                                        }`}>
                                        {inQueue ? "You're in the queue!" : isReady ? "Profile complete — ready for queue" : "Complete your profile"}
                                    </h4>
                                    <p className={`text-sm ${inQueue ? 'text-emerald-600' : isReady ? 'text-blue-600' : 'text-amber-600'
                                        }`}>
                                        {inQueue
                                            ? "We're actively matching you with employers. You'll be notified when there's a match."
                                            : isReady
                                                ? "Your documents are verified. Contact admin to join the queue."
                                                : "Upload and verify your documents to continue."
                                        }
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Pending Offers in Status */}
                        {hasPendingOffer && (
                            <div className="bg-white rounded-xl shadow-sm border border-emerald-200 p-5">
                                <h3 className="font-bold text-[#050505] text-lg mb-3">Active Offers</h3>
                                {pendingOffers.map((offer: any) => (
                                    <Link
                                        key={offer.id}
                                        href={`/profile/worker/offers/${offer.id}`}
                                        className="flex items-center justify-between p-4 bg-emerald-50 rounded-lg border border-emerald-100 hover:border-emerald-300 transition-colors group"
                                    >
                                        <div>
                                            <div className="font-bold text-[#050505]">{offer.job_request?.employer?.company_name || "Company"}</div>
                                            <div className="text-sm text-[#65676b]">{offer.job_request?.title} • {offer.job_request?.destination_country}</div>
                                        </div>
                                        <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-md uppercase">Pending</span>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── COMPONENTS ──────────────────────────────────────────────

function TabButton({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
    return (
        <button
            onClick={onClick}
            className={`px-5 py-3.5 font-semibold text-[15px] whitespace-nowrap transition-colors relative ${active
                ? 'text-[#1877f2]'
                : 'text-[#65676b] hover:bg-[#f0f2f5] rounded-t-lg'
                }`}
        >
            {label}
            {active && (
                <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#1877f2] rounded-t-full" />
            )}
        </button>
    );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode, label: string, value: any }) {
    return (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-[#f7f8fa] border border-[#f0f2f5]">
            <div className="text-[#65676b] mt-0.5 shrink-0">{icon}</div>
            <div className="min-w-0">
                <div className="text-xs font-semibold text-[#65676b] uppercase tracking-wide">{label}</div>
                <div className="text-[#050505] font-medium text-[15px] truncate">
                    {value || <span className="text-[#bcc0c4] italic">Not provided</span>}
                </div>
            </div>
        </div>
    );
}

function DocumentRow({ label, type, status }: { label: string, type: string, status: any }) {
    const IconComponent = status.icon;
    const colorMap: Record<string, string> = {
        emerald: "text-emerald-600 bg-emerald-50 border-emerald-200",
        red: "text-red-600 bg-red-50 border-red-200",
        amber: "text-amber-600 bg-amber-50 border-amber-200",
        blue: "text-blue-600 bg-blue-50 border-blue-200",
        slate: "text-slate-400 bg-slate-50 border-slate-200",
    };
    const badgeMap: Record<string, string> = {
        emerald: "bg-emerald-100 text-emerald-700",
        red: "bg-red-100 text-red-700",
        amber: "bg-amber-100 text-amber-700",
        blue: "bg-blue-100 text-blue-700",
        slate: "bg-slate-100 text-slate-500",
    };

    return (
        <div className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${colorMap[status.color]}`}>
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white border border-current/10 flex items-center justify-center">
                    <FileText size={20} />
                </div>
                <div>
                    <h4 className="font-semibold text-[#050505] text-sm">{label}</h4>
                    <p className="text-xs text-[#65676b]">{type.replace(/_/g, ' ')}</p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <span className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-md ${badgeMap[status.color]}`}>
                    {status.label}
                </span>
                <IconComponent size={18} className={status.color === 'amber' ? 'animate-spin' : ''} />
            </div>
        </div>
    );
}
