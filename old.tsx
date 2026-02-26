"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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
        if (!doc) return { status: "missing", label: "Not uploaded", color: "slate", icon: Upload };
        if (doc.status === "verified") return { status: "verified", label: "Verified", color: "emerald", icon: CheckCircle2 };
        if (doc.status === "rejected") return { status: "rejected", label: "Rejected", color: "red", icon: AlertCircle };
        if (doc.status === "verifying") return { status: "verifying", label: "Verifying...", color: "amber", icon: Loader2 };
        return { status: "uploaded", label: "Uploaded", color: "blue", icon: Clock };
    };

    const displayName = profile?.full_name || user.user_metadata?.full_name || "Worker";
    const docsUploaded = documents.filter(d => d.status === 'verified').length >= 2;

    // Application stages
    const stages = [
        { label: "Profile Created", done: true },
        { label: "Documents Uploaded", done: docsUploaded },
        { label: "Admin Approved", done: adminApproved },
        { label: "Payment & Queue", done: inQueue },
        { label: "Matched", done: false },
    ];

    const hasPendingOffer = pendingOffers && pendingOffers.length > 0;

    return (
        <div className="min-h-screen bg-[#F0F4F8]">
            <UnifiedNavbar variant="dashboard" user={user} profileName={displayName} />

            {/* MAIN CONTENT */}
            <div className="max-w-5xl mx-auto px-4 py-8">

                {/* Hero / Welcome Section */}
                <div className="mb-8 relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#2563EB] to-[#1E3A5F] p-8 text-white shadow-xl">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div>
                            <h1 className="text-3xl font-bold mb-2">Welcome back, {displayName.split(' ')[0]}</h1>
                            <p className="text-blue-100 opacity-90 max-w-lg">
                                Manage your profile, upload documents, and track your job application status all in one place.
                            </p>
                        </div>
                        {profileCompletion < 100 && (
                            <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20 min-w-[200px]">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold uppercase tracking-wider text-blue-100">Profile Completion</span>
                                    <span className="font-bold">{profileCompletion}%</span>
                                </div>
                                <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                                    <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${profileCompletion}%` }} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Employer Matching CTA */}
                <div className="mb-8 bg-white rounded-3xl p-1 shadow-sm border border-slate-100">
                    <div className="bg-gradient-to-r from-[#1877f2] to-[#0d5bbd] rounded-[20px] p-6 text-white relative overflow-hidden group hover:shadow-lg transition-all duration-300">
                        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-white/15 transition-colors" />
                        <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="bg-white/20 p-3 rounded-full backdrop-blur-sm">
                                    <Rocket className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-xl">Get Matched with Employers</h3>
                                    <p className="text-blue-100 text-sm opacity-90">Complete your profile & upload documents — our team will match you with verified employers in Serbia.</p>
                                </div>
                            </div>
                            <Link href="/profile/worker/edit" className="bg-white text-[#1877f2] font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-full shadow-lg hover:shadow-xl transition-shadow whitespace-nowrap">
                                Complete Profile
                            </Link>
                        </div>
                    </div>
                </div>

                {/* TABS Navigation */}
                <div className="flex flex-col md:flex-row gap-6">
                    {/* Sidebar Tabs (Desktop) / Top Tabs (Mobile) */}
                    <div className="md:w-64 flex-shrink-0 space-y-2">
                        <div className="bg-white rounded-2xl p-2 shadow-sm border border-slate-100 sticky top-24">
                            <TabButton label="Profile Info" icon={<User size={18} />} active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} />
                            <TabButton label="Documents" icon={<FileText size={18} />} active={activeTab === 'documents'} onClick={() => setActiveTab('documents')} />
                            <TabButton label="Application Status" icon={<Rocket size={18} />} active={activeTab === 'status'} onClick={() => setActiveTab('status')} />

                            <div className="my-2 border-t border-slate-100"></div>

                            <Link href="/profile/worker/edit" className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 font-medium hover:bg-slate-50 transition-colors w-full text-left">
                                <Pencil size={18} /> Edit Profile
                            </Link>
                        </div>
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 min-w-0">
                        {/* ====================== PROFILE INFO TAB ====================== */}
                        {activeTab === 'profile' && (
                            <div className="space-y-6">
                                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
                                    <h3 className="font-bold text-slate-900 text-xl mb-6 flex items-center gap-2">
                                        <User className="text-blue-500" /> Personal Information
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
                                    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
                                        <h3 className="font-bold text-slate-900 text-xl mb-6 flex items-center gap-2">
                                            <Shield className="text-emerald-500" /> Passport & Travel
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
                                    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
                                        <div className="mb-6">
                                            <h3 className="font-bold text-slate-900 text-xl">Upload Documents</h3>
                                            <p className="text-slate-500 mt-1">Please ensure all documents are clear and readable.</p>
                                        </div>
                                        <DocumentWizard candidateId={user.id} email={user.email || ""} />
                                    </div>
                                )}

                                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
                                    <h3 className="font-bold text-slate-900 text-xl mb-6">Document Status</h3>
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
                                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
                                    <h3 className="font-bold text-slate-900 text-xl mb-8">Application Timeline</h3>
                                    <div className="relative pl-4">
                                        <div className="absolute left-[19px] top-2 bottom-4 w-0.5 bg-slate-100" />
                                        {stages.map((stage, index) => (
                                            <div key={stage.label} className="relative flex items-center gap-6 mb-8 last:mb-0">
                                                <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center border-4 transition-colors ${stage.done
                                                    ? 'bg-emerald-500 border-white shadow-lg shadow-emerald-200 text-white'
                                                    : 'bg-white border-slate-100 text-slate-300'
                                                    }`}>
                                                    {stage.done ? <CheckCircle2 size={18} /> : <span className="text-xs font-bold">{index + 1}</span>}
                                                </div>
                                                <div>
                                                    <h4 className={`font-bold text-lg ${stage.done ? 'text-slate-900' : 'text-slate-400'}`}>{stage.label}</h4>
                                                    {stage.done && index === stages.length - 1 && <p className="text-sm text-emerald-600 font-medium">Completed</p>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {hasPendingOffer && (
                                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl border border-emerald-100 p-8">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="bg-white p-2.5 rounded-xl shadow-sm text-emerald-600">
                                                <PartyPopper size={24} />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-900 text-xl">Job Offers</h3>
                                                <p className="text-slate-500">Congratulations! You have pending offers.</p>
                                            </div>
                                        </div>
                                        {pendingOffers.map((offer: any) => (
                                            <Link
                                                key={offer.id}
                                                href={`/profile/worker/offers/${offer.id}`}
                                                className="block bg-white rounded-xl p-5 border border-emerald-100 hover:shadow-md hover:border-emerald-300 transition-all group"
                                            >
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <h4 className="font-bold text-lg text-slate-900 group-hover:text-emerald-600 transition-colors">
                                                            {offer.job_request?.employer?.company_name || "Confidential Employer"}
                                                        </h4>
                                                        <p className="text-slate-500">{offer.job_request?.title} • {offer.job_request?.destination_country}</p>
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
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${active
                ? 'bg-blue-50 text-blue-700 shadow-sm'
                : 'text-slate-600 hover:bg-slate-50'
                }`}
        >
            <span className={active ? 'text-blue-600' : 'text-slate-400'}>{icon}</span>
            {label}
        </button>
    );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode, label: string, value: any }) {
    return (
        <div className="group">
            <div className="flex items-center gap-2 mb-1.5">
                <span className="text-slate-400 group-hover:text-blue-500 transition-colors">{icon}</span>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</span>
            </div>
            <div className="pl-7 font-medium text-slate-900 text-base border-b border-transparent group-hover:border-slate-100 pb-1 transition-colors">
                {value || <span className="text-slate-300 italic">Not provided</span>}
            </div>
        </div>
    );
}

function DocumentRow({ label, type, status }: { label: string, type: string, status: any }) {
    const IconComponent = status.icon;
    const colorMap: Record<string, string> = {
        emerald: "text-emerald-600 bg-emerald-50 border-emerald-100",
        red: "text-red-600 bg-red-50 border-red-100",
        amber: "text-amber-600 bg-amber-50 border-amber-100",
        blue: "text-blue-600 bg-blue-50 border-blue-100",
        slate: "text-slate-400 bg-slate-50 border-slate-100",
    };

    return (
        <div className={`flex items-center justify-between p-4 rounded-2xl border transition-all hover:shadow-sm ${colorMap[status.color]}`}>
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-sm">
                    <FileText size={22} className="opacity-80" />
                </div>
                <div>
                    <h4 className="font-bold text-slate-900">{label}</h4>
                    <p className="text-xs opacity-70 font-medium">{type.replace(/_/g, ' ')}</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <span className={`text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 rounded-full bg-white/50 border border-current/10`}>
                    {status.label}
                </span>
                <IconComponent size={20} className={status.color === 'amber' ? 'animate-spin' : ''} />
            </div>
        </div>
    );
}
