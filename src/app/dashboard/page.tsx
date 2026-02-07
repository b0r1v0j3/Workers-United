import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isGodModeUser } from "@/lib/godmode";
import DashboardClient from "./DashboardClient";

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

    // Calculate verified count from actual documents
    const verifiedDocs = documents?.filter(d => d.status === 'verified') || [];
    const verifiedCount = verifiedDocs.length;
    const isReady = verifiedCount >= 3; // passport, photo, diploma
    const inQueue = candidate?.status === "IN_QUEUE";

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
        <DashboardClient
            user={user}
            profile={profile}
            candidate={candidate}
            documents={documents || []}
            pendingOffers={pendingOffers || []}
            profileCompletion={profileCompletion}
            isReady={isReady}
            inQueue={inQueue}
        />
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
