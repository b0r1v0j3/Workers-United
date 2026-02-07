"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import DocumentWizard from "@/components/DocumentWizard";
import {
    User,
    Briefcase,
    FileText,
    Building2,
    MapPin,
    Globe,
    Camera,
    Pencil,
    MoreHorizontal,
    Clock,
    ChevronRight,
    Phone
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

const INDUSTRIES = [
    "Construction", "Manufacturing", "Agriculture", "Hospitality",
    "Healthcare", "Transportation", "Retail", "IT & Technology",
    "Food Processing", "Warehousing & Logistics", "Other"
];

type TabType = "timeline" | "about" | "photos" | "documents";

export default function DashboardClient({
    user, profile, candidate, documents = [], pendingOffers = [], profileCompletion, isReady, inQueue
}: DashboardClientProps) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<TabType>("timeline");
    const [isEditing, setIsEditing] = useState(false);

    const getDocStatus = (type: string) => {
        const doc = documents.find(d => d.document_type === type);
        if (!doc) return { status: "missing", label: "Not uploaded", color: "slate" };
        if (doc.status === "verified") return { status: "verified", label: "Verified", color: "emerald" };
        if (doc.status === "rejected") return { status: "rejected", label: "Rejected", color: "red" };
        if (doc.status === "verifying") return { status: "verifying", label: "Verifying...", color: "amber" };
        return { status: "uploaded", label: "Uploaded", color: "blue" };
    };

    const displayName = profile?.full_name || user.user_metadata?.full_name || "Worker";
    const displaySubtitle = candidate?.nationality ? `${candidate.preferred_job || "Worker"} • ${candidate.nationality}` : "International Worker";

    return (
        <AppShell user={user} variant="dashboard">
            {/* PROFILE HEADER */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-4">
                <div className="p-6 pb-0">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900 leading-tight">
                                {displayName}
                            </h1>
                            <p className="text-slate-500 font-semibold text-lg flex items-center gap-2">
                                {displaySubtitle}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Link href="/onboarding" className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2">
                                <Pencil size={18} /> Edit Profile
                            </Link>
                            <button className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg font-semibold hover:bg-slate-200 transition-colors flex items-center gap-2">
                                <FileText size={18} /> Download CV
                            </button>
                        </div>
                    </div>

                    {/* Profile Tabs */}
                    <div className="flex gap-1 border-t border-slate-100 pt-2">
                        <TabButton label="Timeline" onClick={() => setActiveTab('timeline')} active={activeTab === 'timeline'} />
                        <TabButton label="About" onClick={() => setActiveTab('about')} active={activeTab === 'about'} />
                        <TabButton label="Photos" onClick={() => setActiveTab('photos')} active={activeTab === 'photos'} />
                        <TabButton label="Documents" onClick={() => setActiveTab('documents')} active={activeTab === 'documents'} />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-4">

                {/* TIMELINE TAB */}
                {activeTab === 'timeline' && (
                    <>
                        {/* LEFT COLUMN: INTRO & PHOTOS */}
                        <div className="space-y-4">
                            {/* Intro Card */}
                            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
                                <h2 className="text-[20px] font-bold text-slate-900 mb-3">Intro</h2>

                                <div className="space-y-3 text-[15px] text-slate-900">
                                    {/* Status Badge */}
                                    <div className={`flex items-center gap-2 text-center justify-center p-2 rounded-lg ${inQueue ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-600"}`}>
                                        <span className="font-semibold">
                                            {inQueue ? "Verified & In Queue" : isReady ? "Profile Ready" : "Building Profile"}
                                        </span>
                                    </div>

                                    <IntroItem icon={<MapPin size={20} />} text={`Lives in ${candidate?.current_country || "Unknown"}`} />
                                    <IntroItem icon={<Globe size={20} />} text={`From ${candidate?.nationality || "Unknown"}`} />
                                    <IntroItem icon={<Briefcase size={20} />} text={`Looking for ${candidate?.preferred_job || "Any job"}`} />
                                    <IntroItem icon={<Clock size={20} />} text={candidate?.date_of_birth ? new Date(candidate.date_of_birth).toLocaleDateString() : "Born date unknown"} />

                                    <div className="pt-2">
                                        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                                            <span>Profile Completion</span>
                                            <span>{profileCompletion}%</span>
                                        </div>
                                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-blue-600" style={{ width: `${profileCompletion}%` }} />
                                        </div>
                                    </div>
                                </div>

                                <Link href="/onboarding" className="block text-center w-full bg-slate-100 hover:bg-slate-200 py-1.5 rounded-md font-semibold mt-4 text-sm transition-colors text-slate-700">
                                    Edit Bio
                                </Link>
                            </div>

                            {/* Photos Preview */}
                            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
                                <div className="flex justify-between items-center mb-3">
                                    <h2 className="text-[20px] font-bold text-slate-900">Photos</h2>
                                    <button onClick={() => setActiveTab('photos')} className="text-blue-600 hover:bg-blue-50 px-2 py-1 rounded text-[15px]">See all photos</button>
                                </div>
                                <div className="grid grid-cols-3 gap-1 rounded-lg overflow-hidden">
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                                        <div key={i} className="aspect-square bg-slate-100 border border-slate-200 flex items-center justify-center text-xs text-slate-400">
                                            <Camera size={16} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: FEED */}
                        <div className="space-y-4">
                            {/* Create Post (Fake input) */}
                            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3">
                                <div className="flex gap-2 mb-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden shrink-0">
                                        <img src={user.user_metadata?.avatar_url || "/avatar-placeholder.png"} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 bg-slate-100 rounded-full px-3 flex items-center text-slate-500 hover:bg-slate-200 cursor-pointer transition-colors text-[15px]">
                                        What is on your mind, {profile?.full_name?.split(' ')[0]}?
                                    </div>
                                </div>
                                <hr className="border-slate-100" />
                                <div className="flex pt-2">
                                    <div className="flex-1 flex items-center justify-center gap-2 hover:bg-slate-50 py-2 rounded-lg cursor-pointer">
                                        <span className="text-xl">🎥</span> <span className="text-slate-500 font-semibold text-sm">Live video</span>
                                    </div>
                                    <div className="flex-1 flex items-center justify-center gap-2 hover:bg-slate-50 py-2 rounded-lg cursor-pointer">
                                        <span className="text-xl">🖼️</span> <span className="text-slate-500 font-semibold text-sm">Photo/video</span>
                                    </div>
                                    <div className="flex-1 flex items-center justify-center gap-2 hover:bg-slate-50 py-2 rounded-lg cursor-pointer">
                                        <span className="text-xl">😊</span> <span className="text-slate-500 font-semibold text-sm">Feeling/activity</span>
                                    </div>
                                </div>
                            </div>

                            {/* Application Progress "Pinned Post" */}
                            {!isReady && (
                                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <h3 className="font-bold text-slate-900">📌 Action Required</h3>
                                    </div>
                                    <p className="text-sm text-slate-600 mb-4">You need to complete your document upload to start the matching process.</p>
                                    <DocumentWizard candidateId={user.id} email={user.email || ""} />
                                </div>
                            )}

                            {/* Feed Items */}
                            <FeedPost
                                author="Workers United"
                                time="Just now"
                                avatar="/logo.png"
                                text={`Welcome to your profile, **${profile?.full_name || "Worker"}**! This is your personal space to track your application, specific job offers, and document verification status. Complete your profile to get started!`}
                            />

                            {pendingOffers?.map((offer: any) => (
                                <FeedPost
                                    key={offer.id}
                                    author="System Notification"
                                    time="1 hour ago"
                                    avatar="/logo.png"
                                    text="🎉 **You have a new Job Offer!**\nA company is interested in your profile. Check the details immediately as this offer expires in 24 hours."
                                >
                                    <Link href={`/dashboard/offers/${offer.id}`} className="mt-3 block bg-blue-50 p-3 rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors">
                                        <div className="font-bold text-blue-700">{offer.job_request?.employer?.company_name}</div>
                                        <div className="text-sm text-slate-600">{offer.job_request?.destination_country}</div>
                                    </Link>
                                </FeedPost>
                            ))}
                        </div>
                    </>
                )}

                {/* ABOUT TAB */}
                {activeTab === 'about' && (
                    <div className="col-span-1 lg:col-span-2 space-y-4">
                        <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
                            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                                <h2 className="text-xl font-bold text-slate-900">About</h2>
                                <Link href="/onboarding" className="text-blue-600 font-semibold hover:bg-blue-50 px-3 py-1 rounded-lg">
                                    Edit
                                </Link>
                            </div>
                            <div className="p-6 space-y-4 text-slate-700">
                                <DetailRow label="Full Name" value={candidate?.profiles?.full_name} />
                                <DetailRow label="Nationality" value={candidate?.nationality} />
                                <DetailRow label="Current Location" value={candidate?.current_country} />
                                <DetailRow label="Date of Birth" value={candidate?.date_of_birth ? new Date(candidate.date_of_birth).toLocaleDateString() : null} />
                                <DetailRow label="Phone" value={candidate?.phone} />
                                <DetailRow label="Preferred Job" value={candidate?.preferred_job} />
                                <DetailRow label="Experience" value={candidate?.experience_years ? `${candidate.experience_years} years` : null} />
                                <DetailRow label="Languages" value={candidate?.languages?.join(", ")} />
                            </div>
                        </div>
                    </div>
                )}

                {/* PHOTOS TAB */}
                {activeTab === 'photos' && (
                    <div className="col-span-1 lg:col-span-2">
                        <div className="bg-white rounded-xl shadow border border-slate-200 p-4">
                            <h2 className="text-xl font-bold text-slate-900 mb-4">Photos</h2>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                                    <div key={i} className="aspect-square bg-slate-100 rounded-lg flex items-center justify-center text-slate-300">
                                        <Camera size={32} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* DOCUMENTS TAB */}
                {activeTab === 'documents' && (
                    <div className="col-span-1 lg:col-span-2">
                        <div className="bg-white rounded-xl shadow border border-slate-200 p-6">
                            <h2 className="text-xl font-bold text-slate-900 mb-6">My Documents</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <DocumentCard label="Passport" status={getDocStatus("passport")} />
                                <DocumentCard label="Photo" status={getDocStatus("biometric_photo")} />
                                <DocumentCard label="Diploma" status={getDocStatus("diploma")} />
                                <DocumentCard label="Certificate" status={getDocStatus("certificate")} />
                                <DocumentCard label="Police Record" status={getDocStatus("police_record")} />
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </AppShell>
    );
}

// ----------------------------------------------------------------------
// COMPONENTS
// ----------------------------------------------------------------------

function TabButton({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
    return (
        <button
            onClick={onClick}
            className={`px-4 py-3 font-semibold text-[15px] whitespace-nowrap transition-colors relative ${active ? 'text-blue-600' : 'text-slate-600 hover:bg-slate-100 rounded-lg'}`}
        >
            {label}
            {active && (
                <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-blue-600 rounded-t-full" />
            )}
        </button>
    );
}

function IntroItem({ icon, text }: { icon: React.ReactNode, text: React.ReactNode }) {
    return (
        <div className="flex items-center gap-3 text-slate-700">
            <div className="text-slate-400">
                {icon}
            </div>
            <span className="text-[15px] font-medium leading-tight">{text}</span>
        </div>
    );
}

function FeedPost({ author, time, avatar, text, children }: { author: string, time: string, avatar: string, text: string, children?: React.ReactNode }) {
    return (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
            <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100">
                    <img src={avatar} className="w-full h-full object-cover" />
                </div>
                <div>
                    <div className="font-bold text-slate-900 text-[15px]">{author}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-1">
                        {time} • <span>🌍</span>
                    </div>
                </div>
                <div className="ml-auto text-slate-400 hover:bg-slate-100 p-2 rounded-full cursor-pointer">
                    <MoreHorizontal size={20} />
                </div>
            </div>

            <div className="text-[15px] text-slate-900 leading-normal whitespace-pre-wrap mb-2">
                {text}
            </div>

            {children}

            <hr className="my-3 border-slate-100" />

            <div className="flex gap-1">
                <div className="flex-1 flex items-center justify-center gap-2 hover:bg-slate-50 py-1.5 rounded text-slate-500 font-semibold text-[14px] cursor-pointer">
                    <span className="text-lg">👍</span> Like
                </div>
                <div className="flex-1 flex items-center justify-center gap-2 hover:bg-slate-50 py-1.5 rounded text-slate-500 font-semibold text-[14px] cursor-pointer">
                    <span className="text-lg">💬</span> Comment
                </div>
                <div className="flex-1 flex items-center justify-center gap-2 hover:bg-slate-50 py-1.5 rounded text-slate-500 font-semibold text-[14px] cursor-pointer">
                    <span className="text-lg">↗️</span> Share
                </div>
            </div>
        </div>
    )
}

function DetailRow({ label, value }: { label: string, value: any }) {
    if (!value) return null;
    return (
        <div className="w-full py-2 border-b border-slate-50 last:border-0">
            <span className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">{label}</span>
            <span className="text-slate-900 font-medium text-base">{value}</span>
        </div>
    );
}

function DocumentCard({ label, status }: { label: string, status: any }) {
    const bgColors: any = {
        emerald: "bg-emerald-100 text-emerald-700",
        red: "bg-red-100 text-red-700",
        amber: "bg-amber-100 text-amber-700",
        blue: "bg-blue-100 text-blue-700",
        slate: "bg-slate-100 text-slate-600"
    };

    return (
        <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-blue-200 transition-colors group cursor-pointer">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${status.color === 'emerald' ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-slate-400'} border border-slate-200`}>
                    <FileText size={20} />
                </div>
                <div>
                    <h4 className="font-semibold text-slate-800 text-sm group-hover:text-blue-600 transition-colors">{label}</h4>
                    <p className="text-xs text-slate-500">Document</p>
                </div>
            </div>
            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md ${bgColors[status.color]}`}>
                {status.label}
            </span>
        </div>
    );
}
