"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import DocumentWizard from "@/components/DocumentWizard";
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
    Heart,
    Users
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
            toast.success("Profile 100% Complete! 🎉");
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

    // Check if required documents are uploaded (independently of profile fields)
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
        <div className="min-h-screen bg-[#f0f2f5]">
            {/* NAVBAR */}
            <nav className="bg-white shadow-sm sticky top-0 z-50 border-b border-[#dddfe2] h-[62px]">
                <div className="max-w-[1100px] mx-auto px-4 h-full flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
                        <img src="/logo.png" alt="Workers United" className="h-[60px] w-auto object-contain" />
                        <span className="font-bold text-[#1E3A5F] text-xl hidden sm:inline tracking-tight">
                            Workers United
                        </span>
                    </Link>
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-[#050505] hidden sm:block">
                            {displayName}
                        </span>
                        <Link
                            href="/profile/settings"
                            className="w-9 h-9 bg-[#f0f2f5] rounded-full flex items-center justify-center text-[#050505] hover:bg-[#e4e6eb] transition-colors"
                            title="Account Settings"
                        >
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                                <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z" />
                            </svg>
                        </Link>
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

                {/* Coming Soon / Job Matching CTA — will become payment gateway */}
                <div className="mb-4 bg-gradient-to-r from-[#1877f2] to-[#0d5bbd] rounded-xl shadow-lg p-5 text-white relative overflow-hidden transform hover:scale-[1.02] transition-all duration-300 cursor-default">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
                    <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-2xl">🚀</span>
                                <h3 className="font-bold text-lg">Get Matched with Employers</h3>
                            </div>
                            <p className="text-blue-100 text-sm max-w-md">
                                We're building a fast-track job matching system to connect you with verified employers across Europe. Stay tuned!
                            </p>
                        </div>
                        <div className="shrink-0">
                            <span className="bg-white/20 backdrop-blur-sm text-white text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border border-white/30">
                                Coming Soon
                            </span>
                        </div>
                    </div>
                </div>

                {/* Profile Completion — always visible */}
                {profileCompletion < 100 && (
                    <div className="bg-white rounded-xl shadow-sm border border-[#dddfe2] p-5 mb-4">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="font-bold text-[#050505]">Profile Completion</h3>
                            <span className="text-sm font-bold text-[#1877f2]">
                                {profileCompletion}%
                            </span>
                        </div>
                        <div className="h-2.5 bg-[#f0f2f5] rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-500 bg-[#1877f2]"
                                style={{ width: `${profileCompletion}%` }}
                            />
                        </div>
                        <p className="text-xs text-[#65676b] mt-2">
                            Complete your profile to get matched with employers faster.
                        </p>
                    </div>
                )}

                {/* TABS */}
                <div className="bg-white rounded-lg shadow-sm border border-[#dddfe2] mb-4">
                    <div className="flex items-center px-2">
                        <div className="flex overflow-x-auto scrollbar-hide">
                            <TabButton label="Profile Info" active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} />
                            <TabButton label="Documents" active={activeTab === 'documents'} onClick={() => setActiveTab('documents')} />
                            <TabButton label="Status" active={activeTab === 'status'} onClick={() => setActiveTab('status')} />
                        </div>
                        <div className="ml-auto pr-2">
                            <Link
                                href="/profile/worker/edit"
                                className="bg-[#1877f2] text-white px-4 py-2 rounded-md font-semibold text-sm hover:bg-[#166fe5] transition-colors flex items-center gap-2 whitespace-nowrap"
                            >
                                <Pencil size={14} /> Edit Profile
                            </Link>
                        </div>
                    </div>
                </div>

                {/* ====================== PROFILE INFO TAB ====================== */}
                {activeTab === 'profile' && (
                    <div className="space-y-4">

                        {/* Personal Information */}
                        <div className="bg-white rounded-xl shadow-sm border border-[#dddfe2] p-5 hover:shadow-md transition-shadow duration-300">
                            <div className="mb-4">
                                <h3 className="font-bold text-[#050505] text-lg">Personal Information</h3>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <InfoRow icon={<User size={18} />} label="Full Name" value={profile?.full_name || candidate?.profiles?.full_name} />
                                <InfoRow icon={<User size={18} />} label="Gender" value={candidate?.gender} />
                                <InfoRow icon={<Globe size={18} />} label="Nationality" value={candidate?.nationality} />
                                <InfoRow icon={<Heart size={18} />} label="Marital Status" value={candidate?.marital_status} />
                                <InfoRow icon={<Calendar size={18} />} label="Date of Birth" value={candidate?.date_of_birth ? new Date(candidate.date_of_birth).toLocaleDateString('en-GB') : null} />
                                <InfoRow icon={<MapPin size={18} />} label="Birth Place" value={candidate?.birth_city && candidate?.birth_country ? `${candidate.birth_city}, ${candidate.birth_country}` : (candidate?.birth_country || null)} />
                                <InfoRow icon={<Globe size={18} />} label="Citizenship" value={candidate?.citizenship} />
                                <InfoRow icon={<Globe size={18} />} label="Original Citizenship" value={candidate?.original_citizenship && candidate.original_citizenship !== candidate.citizenship ? candidate.original_citizenship : null} />
                                <InfoRow icon={<User size={18} />} label="Maiden Name" value={candidate?.maiden_name} />
                                <InfoRow icon={<User size={18} />} label="Father's Name" value={candidate?.father_name} />
                                <InfoRow icon={<User size={18} />} label="Mother's Name" value={candidate?.mother_name} />
                                <InfoRow icon={<MapPin size={18} />} label="Current Location" value={candidate?.current_country} />
                                <InfoRow icon={<Phone size={18} />} label="Phone" value={candidate?.phone} />
                                <InfoRow icon={<MapPin size={18} />} label="Address" value={candidate?.address} />
                                <InfoRow icon={<Briefcase size={18} />} label="Preferred Job" value={candidate?.preferred_job} />
                            </div>
                        </div>

                        {/* Family Information */}
                        {candidate?.family_data && (candidate.family_data.spouse || (candidate.family_data.children && candidate.family_data.children.length > 0)) && (
                            <div className="bg-white rounded-xl shadow-sm border border-[#dddfe2] p-5 hover:shadow-md transition-shadow duration-300">
                                <h3 className="font-bold text-[#050505] text-lg mb-4 flex items-center gap-2">
                                    <Users size={20} /> Family Information
                                </h3>
                                {candidate.family_data.spouse && (
                                    <div className="mb-4">
                                        <h4 className="text-sm font-semibold text-gray-600 mb-2">Spouse</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <InfoRow icon={<User size={18} />} label="Name" value={`${candidate.family_data.spouse.first_name} ${candidate.family_data.spouse.last_name}`} />
                                            <InfoRow icon={<Calendar size={18} />} label="Date of Birth" value={candidate.family_data.spouse.dob ? new Date(candidate.family_data.spouse.dob).toLocaleDateString('en-GB') : null} />
                                            <InfoRow icon={<MapPin size={18} />} label="Birth Place" value={candidate.family_data.spouse.birth_city && candidate.family_data.spouse.birth_country ? `${candidate.family_data.spouse.birth_city}, ${candidate.family_data.spouse.birth_country}` : null} />
                                        </div>
                                    </div>
                                )}
                                {candidate.family_data.children && candidate.family_data.children.length > 0 && (
                                    <div>
                                        <h4 className="text-sm font-semibold text-gray-600 mb-2">Children ({candidate.family_data.children.length})</h4>
                                        <div className="space-y-2">
                                            {candidate.family_data.children.map((child: any, i: number) => (
                                                <div key={i} className="flex items-center gap-4 text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">
                                                    <span className="font-medium">{child.first_name} {child.last_name}</span>
                                                    {child.dob && <span className="text-gray-500">Born: {new Date(child.dob).toLocaleDateString('en-GB')}</span>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Passport Information */}
                        {candidate?.passport_number && (
                            <div className="bg-white rounded-xl shadow-sm border border-[#dddfe2] p-5 hover:shadow-md transition-shadow duration-300">
                                <h3 className="font-bold text-[#050505] text-lg mb-4 flex items-center gap-2">
                                    <Shield size={20} /> Passport & Travel
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <InfoRow icon={<FileText size={18} />} label="Passport Number" value={candidate.passport_number ? `***${candidate.passport_number.slice(-4)}` : null} />
                                    <InfoRow icon={<Globe size={18} />} label="Issued By" value={candidate.passport_issued_by} />
                                    <InfoRow icon={<Calendar size={18} />} label="Issue Date" value={candidate.passport_issue_date ? new Date(candidate.passport_issue_date).toLocaleDateString('en-GB') : null} />
                                    <InfoRow icon={<Calendar size={18} />} label="Expiry Date" value={candidate.passport_expiry_date ? new Date(candidate.passport_expiry_date).toLocaleDateString('en-GB') : null} />
                                    <InfoRow icon={<Globe size={18} />} label="Lives Abroad" value={candidate.lives_abroad} />
                                    <InfoRow icon={<FileText size={18} />} label="Previous Visas (3 years)" value={candidate.previous_visas} />
                                </div>
                            </div>
                        )}

                        {/* Pending Offers */}
                        {hasPendingOffer && (
                            <div className="bg-gradient-to-r from-emerald-50 to-blue-50 rounded-xl shadow-sm border border-emerald-200 p-5 hover:shadow-md transition-shadow duration-300">
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
                        <div className="bg-white rounded-xl shadow-sm border border-[#dddfe2] p-6 hover:shadow-md transition-shadow duration-300">
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
                        {(() => {
                            const profileDone = profileCompletion === 100;
                            let bg, border, iconBg, iconEl, title, subtitle, titleColor, subtitleColor;

                            if (inQueue) {
                                bg = 'bg-emerald-50'; border = 'border-emerald-200'; iconBg = 'bg-emerald-500';
                                iconEl = <CheckCircle2 size={20} />; titleColor = 'text-emerald-800'; subtitleColor = 'text-emerald-600';
                                title = "You're in the queue!";
                                subtitle = "We're actively matching you with employers. You'll be notified when there's a match.";
                            } else if (isReady && adminApproved) {
                                bg = 'bg-blue-50'; border = 'border-blue-200'; iconBg = 'bg-[#1877f2]';
                                iconEl = <Clock size={20} />; titleColor = 'text-blue-800'; subtitleColor = 'text-blue-600';
                                title = "Profile approved — ready to pay";
                                subtitle = "Your profile has been approved by our team. Pay the entry fee to join the queue.";
                            } else if (isReady && !adminApproved) {
                                bg = 'bg-purple-50'; border = 'border-purple-200'; iconBg = 'bg-purple-500';
                                iconEl = <Clock size={20} />; titleColor = 'text-purple-800'; subtitleColor = 'text-purple-600';
                                title = "Profile under review";
                                subtitle = "Your profile is complete and being reviewed by our team. You'll be notified once approved.";
                            } else if (docsUploaded && !profileDone) {
                                bg = 'bg-amber-50'; border = 'border-amber-200'; iconBg = 'bg-amber-500';
                                iconEl = <AlertCircle size={20} />; titleColor = 'text-amber-800'; subtitleColor = 'text-amber-600';
                                title = "Almost there — complete your profile";
                                subtitle = `Your documents are verified, but your profile is ${profileCompletion}% complete. Fill in the missing fields to continue.`;
                            } else {
                                bg = 'bg-amber-50'; border = 'border-amber-200'; iconBg = 'bg-amber-500';
                                iconEl = <AlertCircle size={20} />; titleColor = 'text-amber-800'; subtitleColor = 'text-amber-600';
                                title = "Complete your profile";
                                subtitle = "Upload your documents and fill in your profile information to get started.";
                            }

                            return (
                                <div className={`rounded-xl shadow-sm border p-5 ${bg} ${border}`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${iconBg} text-white`}>
                                            {iconEl}
                                        </div>
                                        <div>
                                            <h4 className={`font-bold ${titleColor}`}>{title}</h4>
                                            <p className={`text-sm ${subtitleColor}`}>{subtitle}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

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
