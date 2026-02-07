
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DocumentWizard from "@/components/DocumentWizard";
import { isGodModeUser } from "@/lib/godmode";
import AppShell from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    // Redirect employers to employer dashboard
    const userType = user.user_metadata?.user_type;
    if (userType === 'employer') {
        redirect("/employer/dashboard");
    }

    // Fetch profile
    const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    // Fetch candidate data
    const { data: candidate } = await supabase
        .from("candidates")
        .select("*")
        .eq("profile_id", user.id)
        .single();

    // Fetch documents
    const { data: documents } = await supabase
        .from("candidate_documents")
        .select("document_type, status, reject_reason")
        .eq("user_id", user.id);

    // Fetch pending offers
    const { data: pendingOffers } = await supabase
        .from("offers")
        .select("*, job_request:job_requests(title, destination_country, employer:employers(company_name))")
        .eq("candidate_id", candidate?.id)
        .eq("status", "pending");

    const docStatus = (type: string) => {
        const doc = documents?.find(d => d.document_type === type);
        return doc?.status || "missing";
    };

    // Calculate verified count from actual documents
    const verifiedDocs = documents?.filter(d => d.status === 'verified') || [];
    const verifiedCount = verifiedDocs.length;
    const isReady = verifiedCount >= 3; // passport, photo, diploma
    const inQueue = candidate?.status === "IN_QUEUE";
    const hasPendingOffer = pendingOffers && pendingOffers.length > 0;
    const isOwner = isGodModeUser(user.email);

    // Calculate profile completion
    const profileFields = [
        candidate?.phone,
        candidate?.nationality,
        candidate?.current_country,
        candidate?.preferred_job,
        documents?.some(d => d.document_type === "passport"),
        documents?.some(d => d.document_type === "biometric_photo"),
        candidate?.signature_url
    ];
    const completedFields = profileFields.filter(Boolean).length;
    const profileCompletion = Math.round((completedFields / profileFields.length) * 100);

    return (
        <AppShell user={user} variant="dashboard">
            {/* PROFILE HEADER */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-4">
                <div className="p-6 pb-0">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                        <div>
                            <h1 className="text-3xl font-bold text-[#050505] leading-tight">
                                {profile?.full_name || user.user_metadata?.full_name || "Worker"}
                            </h1>
                            <p className="text-[#65676b] font-semibold text-lg flex items-center gap-2">
                                {candidate?.preferred_job ? `${candidate.preferred_job} • ` : ""}
                                {candidate?.nationality || "International Worker"}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Link href="/onboarding" className="bg-[#1877f2] text-white px-4 py-2 rounded-md font-semibold hover:bg-[#166fe5] transition-colors flex items-center gap-2">
                                ✏️ Edit Profile
                            </Link>
                            <button className="bg-[#e4e6eb] text-[#050505] px-4 py-2 rounded-md font-semibold hover:bg-[#d8dadf] transition-colors">
                                ⬇️ Download CV
                            </button>
                        </div>
                    </div>

                    {/* Profile Tabs */}
                    <div className="flex gap-1 border-t border-gray-200 pt-2">
                        <ProfileTab label="Posts" active />
                        <ProfileTab label="About" />
                        <ProfileTab label="Photos" />
                        <ProfileTab label="Documents" />
                    </div>
                </div>
            </div>

            {/* MAIN CONTENT GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-4">

                {/* LEFT COLUMN: INTRO & PHOTOS */}
                <div className="space-y-4">
                    {/* Intro Card */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                        <h2 className="text-[20px] font-bold text-[#050505] mb-3">Intro</h2>

                        <div className="space-y-3 text-[15px] text-[#050505]">
                            {/* Status Badge */}
                            <div className="flex items-center gap-2 text-center justify-center p-2 bg-[#f0f2f5] rounded-lg">
                                <span className={`font-semibold ${inQueue ? "text-green-600" : "text-gray-600"}`}>
                                    {inQueue ? "Verified & In Queue" : isReady ? "Profile Ready" : "Building Profile"}
                                </span>
                            </div>

                            <IntroItem icon="📍" text={`Lives in ${candidate?.current_country || "Unknown"}`} />
                            <IntroItem icon="🌍" text={`From ${candidate?.nationality || "Unknown"}`} />
                            <IntroItem icon="💼" text={`Looking for ${candidate?.preferred_job || "Any job"}`} />
                            <IntroItem icon="🎂" text={candidate?.date_of_birth ? new Date(candidate.date_of_birth).toLocaleDateString() : "Born date unknown"} />

                            <div className="pt-2">
                                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                                    <span>Profile Completion</span>
                                    <span>{profileCompletion}%</span>
                                </div>
                                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-[#1877f2]" style={{ width: `${profileCompletion}%` }} />
                                </div>
                            </div>
                        </div>

                        <Link href="/onboarding" className="block text-center w-full bg-[#e4e6eb] hover:bg-[#d8dadf] py-1.5 rounded-md font-semibold mt-4 text-sm transition-colors">
                            Edit Bio
                        </Link>
                    </div>

                    {/* Photos / Documents Preview */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                        <div className="flex justify-between items-center mb-3">
                            <h2 className="text-[20px] font-bold text-[#050505]">Photos</h2>
                            <Link href="/documents" className="text-[#1877f2] hover:bg-blue-50 px-2 py-1 rounded text-[15px]">See all photos</Link>
                        </div>
                        <div className="grid grid-cols-3 gap-1 rounded-lg overflow-hidden">
                            {/* Placeholder Photos / Documents */}
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                                <div key={i} className="aspect-square bg-gray-100 border border-gray-200 flex items-center justify-center text-xs text-gray-400">
                                    Docs
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: FEED */}
                <div className="space-y-4">
                    {/* Create Post (Fake input) */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
                        <div className="flex gap-2 mb-3">
                            <img src={user.user_metadata?.avatar_url || "/logo.png"} className="w-10 h-10 rounded-full bg-gray-200 object-cover" />
                            <div className="flex-1 bg-[#f0f2f5] rounded-full px-3 flex items-center text-gray-500 hover:bg-[#e4e6eb] cursor-pointer transition-colors text-[15px]">
                                What is on your mind, {profile?.full_name?.split(' ')[0]}?
                            </div>
                        </div>
                        <hr className="border-gray-200" />
                        <div className="flex pt-2">
                            <div className="flex-1 flex items-center justify-center gap-2 hover:bg-gray-100 py-2 rounded-lg cursor-pointer">
                                <span>🎥</span> <span className="text-gray-500 font-semibold text-sm">Live video</span>
                            </div>
                            <div className="flex-1 flex items-center justify-center gap-2 hover:bg-gray-100 py-2 rounded-lg cursor-pointer">
                                <span>🖼️</span> <span className="text-gray-500 font-semibold text-sm">Photo/video</span>
                            </div>
                            <div className="flex-1 flex items-center justify-center gap-2 hover:bg-gray-100 py-2 rounded-lg cursor-pointer">
                                <span>😊</span> <span className="text-gray-500 font-semibold text-sm">Feeling/activity</span>
                            </div>
                        </div>
                    </div>

                    {/* Application Progress "Pinned Post" */}
                    {!isReady && (
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <h3 className="font-bold text-[#050505]">📌 Action Required</h3>
                            </div>
                            <p className="text-sm text-gray-600 mb-4">You need to complete your document upload to start the matching process.</p>
                            <DocumentWizard candidateId={user.id} email={user.email || ""} />
                        </div>
                    )}

                    {/* STATUS UPDATES (FEED) */}

                    {/* Welcome Post */}
                    <FeedPost
                        author="Workers United"
                        time="Just now"
                        avatar="/logo.png"
                        text={`Welcome to your profile, **${profile?.full_name || "Worker"}**! This is your personal space to track your application, specific job offers, and document verification status. Complete your profile to get started!`}
                    />

                    {/* Offer Post */}
                    {hasPendingOffer && (
                        <FeedPost
                            author="System Notification"
                            time="1 hour ago"
                            avatar="/logo.png"
                            text="🎉 **You have a new Job Offer!**\nA company is interested in your profile. Check the details immediately as this offer expires in 24 hours."
                        >
                            <Link href={`/dashboard/offers/${pendingOffers![0].id}`} className="mt-3 block bg-[#e7f3ff] p-3 rounded-lg border border-blue-100 hover:bg-[#dbe7f2]">
                                <div className="font-bold text-[#1877f2]">{pendingOffers![0].job_request?.employer?.company_name}</div>
                                <div className="text-sm text-gray-600">{pendingOffers![0].job_request?.destination_country}</div>
                            </Link>
                        </FeedPost>
                    )}
                </div>
            </div>
        </AppShell>
    );
}

function ProfileTab({ label, active }: { label: string, active?: boolean }) {
    return (
        <div className={`px-4 py-3 font-semibold text-[15px] cursor-pointer relative ${active ? "text-[#1877f2]" : "text-[#65676b] hover:bg-gray-100 rounded-lg"}`}>
            {label}
            {active && <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#1877f2]" />}
        </div>
    )
}

function IntroItem({ icon, text }: { icon: string, text: string }) {
    return (
        <div className="flex items-center gap-3 text-[#050505]">
            <div className="text-xl text-gray-400">{icon}</div>
            <span>{text}</span>
        </div>
    )
}

function FeedPost({ author, time, avatar, text, children }: { author: string, time: string, avatar: string, text: string, children?: React.ReactNode }) {
    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3 mb-3">
                <img src={avatar} className="w-10 h-10 rounded-full object-cover" />
                <div>
                    <div className="font-bold text-[#050505] text-[15px]">{author}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                        {time} • <span>🌍</span>
                    </div>
                </div>
                <div className="ml-auto text-gray-400 hover:bg-gray-100 p-2 rounded-full cursor-pointer">...</div>
            </div>

            <div className="text-[15px] text-[#050505] leading-normal whitespace-pre-wrap mb-2">
                {text}
            </div>

            {children}

            <hr className="my-3 border-gray-200" />

            <div className="flex gap-1">
                <div className="flex-1 flex items-center justify-center gap-2 hover:bg-gray-100 py-1.5 rounded text-gray-500 font-semibold text-[14px]">
                    👍 Like
                </div>
                <div className="flex-1 flex items-center justify-center gap-2 hover:bg-gray-100 py-1.5 rounded text-gray-500 font-semibold text-[14px]">
                    💬 Comment
                </div>
                <div className="flex-1 flex items-center justify-center gap-2 hover:bg-gray-100 py-1.5 rounded text-gray-500 font-semibold text-[14px]">
                    ↗️ Share
                </div>
            </div>
        </div>
    )
}
