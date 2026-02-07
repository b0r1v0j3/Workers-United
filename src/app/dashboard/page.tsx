import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DocumentWizard from "@/components/DocumentWizard";
import { createCheckoutSession } from "@/app/actions/stripe";
import { isGodModeUser } from "@/lib/godmode";

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

    // Fetch readiness
    const { data: readiness } = await supabase
        .from("candidate_readiness")
        .select("*")
        .eq("user_id", user.id)
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

    // Calculate days remaining (90-day guarantee)
    let daysRemaining = 0;
    let refundEligible = candidate?.refund_eligible ?? true;
    if (candidate?.refund_deadline) {
        const deadline = new Date(candidate.refund_deadline);
        const now = new Date();
        daysRemaining = Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    }

    return (
        <>
            <div className="max-w-[700px] mx-auto px-5 py-8">
                {/* Greeting */}
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-[#1e293b]">
                        Hello, {profile?.full_name?.split(' ')[0] || user.user_metadata?.full_name?.split(' ')[0] || "there"} 👋
                    </h1>
                    <p className="text-[#64748b] text-sm font-medium">Here is the live status of your application.</p>
                </div>

                {/* Owner Quick Navigation - Only for God Mode user */}
                {isOwner && (
                    <div className="mb-6 p-4 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <div>
                                <div className="text-xs font-medium text-white/70 mb-1">🔮 Owner Mode</div>
                                <div className="text-sm font-semibold text-white">Quick Dashboard Switch</div>
                            </div>
                            <div className="flex gap-2">
                                <span
                                    style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff' }}
                                    className="px-3 py-1.5 rounded-lg text-sm font-medium"
                                >
                                    👷 Worker
                                </span>
                                <a
                                    href="/employer/dashboard"
                                    style={{ backgroundColor: '#fff', color: '#7c3aed' }}
                                    className="px-3 py-1.5 rounded-lg text-sm font-semibold no-underline"
                                >
                                    🏢 Employer
                                </a>
                                <a
                                    href="/admin"
                                    style={{ backgroundColor: '#fff', color: '#4f46e5' }}
                                    className="px-3 py-1.5 rounded-lg text-sm font-semibold no-underline"
                                >
                                    ⚙️ Admin
                                </a>
                            </div>
                        </div>
                    </div>
                )}
                {/* Status Cards Grid */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    {/* Profile Completion */}
                    <div className="bg-white rounded-xl p-5 shadow-sm border border-[#dde3ec]">
                        <div className="text-[#64748b] text-xs font-medium mb-2">Profile Completion</div>
                        <div className="text-2xl font-bold text-[#183b56]">{profileCompletion}%</div>
                        <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-[#2f6fed] to-[#10b981] rounded-full transition-all"
                                style={{ width: `${profileCompletion}%` }}
                            />
                        </div>
                    </div>

                    {/* Queue Status */}
                    <div className="bg-white rounded-xl p-5 shadow-sm border border-[#dde3ec]">
                        <div className="text-[#64748b] text-xs font-medium mb-2">Status</div>
                        <div className={`text-lg font-bold ${hasPendingOffer ? "text-orange-500" :
                            inQueue ? "text-green-600" :
                                isReady ? "text-blue-600" : "text-gray-500"
                            }`}>
                            {hasPendingOffer ? "🔔 Job Offer!" :
                                inQueue ? "🔍 Searching..." :
                                    isReady ? "✓ Verified" : "📝 Incomplete"}
                        </div>
                        <div className="text-xs text-[#64748b] mt-1">
                            {hasPendingOffer ? "Action required" :
                                inQueue ? `Position #${candidate?.queue_position || "-"}` :
                                    isReady ? "Ready for activation" : "Complete your profile"}
                        </div>
                    </div>
                </div>

                {/* Profile Info Card */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-[#dde3ec] mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-bold text-[#183b56]">👤 Your Profile</h2>
                        <Link
                            href="/onboarding"
                            className="text-sm text-[#2f6fed] hover:text-[#1e5cd6] font-medium flex items-center gap-1"
                        >
                            ✏️ Edit
                        </Link>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-[#64748b]">Full Name:</span>
                            <div className="font-medium text-[#183b56]">{profile?.full_name || "—"}</div>
                        </div>
                        <div>
                            <span className="text-[#64748b]">Email:</span>
                            <div className="font-medium text-[#183b56]">{user.email || "—"}</div>
                        </div>
                        <div>
                            <span className="text-[#64748b]">Phone:</span>
                            <div className="font-medium text-[#183b56]">{candidate?.phone || "—"}</div>
                        </div>
                        <div>
                            <span className="text-[#64748b]">Nationality:</span>
                            <div className="font-medium text-[#183b56]">{candidate?.nationality || "—"}</div>
                        </div>
                        <div>
                            <span className="text-[#64748b]">Date of Birth:</span>
                            <div className="font-medium text-[#183b56]">
                                {candidate?.date_of_birth ?
                                    new Date(candidate.date_of_birth).toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit', year: 'numeric' })
                                    : "—"}
                            </div>
                        </div>
                        <div>
                            <span className="text-[#64748b]">Preferred Job:</span>
                            <div className="font-medium text-[#183b56]">{candidate?.preferred_job || "—"}</div>
                        </div>
                    </div>

                    {(!candidate?.phone || !candidate?.nationality || !candidate?.preferred_job) && (
                        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <p className="text-amber-800 text-xs font-medium">
                                ⚠️ Some profile info is missing. <Link href="/onboarding" className="underline">Complete your profile</Link> to proceed.
                            </p>
                        </div>
                    )}
                </div>

                {/* 90-Day Countdown (if in queue) */}
                {inQueue && (
                    <div className="bg-gradient-to-r from-[#183b56] to-[#2f6fed] rounded-xl p-6 mb-8 text-white">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-white/70 text-sm font-medium mb-1">90-Day Money-Back Guarantee</div>
                                <div className="text-3xl font-bold">{daysRemaining} days left</div>
                                <div className="text-white/80 text-sm mt-1">
                                    {refundEligible
                                        ? "Full refund if no job found"
                                        : "Refund eligibility lost due to offer rejection"}
                                </div>
                            </div>
                            <div className="text-6xl opacity-20">⏳</div>
                        </div>
                    </div>
                )}

                {/* Pending Offer Alert */}
                {hasPendingOffer && pendingOffers && (
                    <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-6 mb-8">
                        <div className="flex items-start gap-4">
                            <div className="text-3xl">🎉</div>
                            <div className="flex-1">
                                <h3 className="font-bold text-orange-800 text-lg mb-1">You have a job offer!</h3>
                                <p className="text-orange-700 text-sm mb-3">
                                    <strong>{pendingOffers[0].job_request?.employer?.company_name}</strong> in {" "}
                                    <strong>{pendingOffers[0].job_request?.destination_country}</strong>
                                </p>
                                <p className="text-orange-600 text-xs mb-4">
                                    ⚠️ This offer expires in 24 hours. Declining may affect your refund eligibility.
                                </p>
                                <div className="flex gap-3">
                                    <Link
                                        href={`/dashboard/offers/${pendingOffers[0].id}`}
                                        className="bg-orange-500 text-white px-5 py-2 rounded-lg font-bold text-sm hover:bg-orange-600 transition-colors"
                                    >
                                        View Offer
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Document Upload (if not ready) - ABOVE PROGRESS */}
                {!isReady && (
                    <DocumentWizard
                        candidateId={user.id}
                        email={user.email || ""}
                    />
                )}

                {/* Verification Progress */}
                <div className="bg-white rounded-xl p-6 shadow-sm mb-6 border border-[#dde3ec]">
                    <h2 className="font-bold text-[#183b56] mb-4">Application Progress</h2>
                    <div className="space-y-4">
                        {/* Step 1: Application */}
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center text-sm font-bold">✓</div>
                            <div>
                                <div className="font-medium text-[#183b56]">Application Received</div>
                                <div className="text-xs text-[#64748b]">Your account is created</div>
                            </div>
                        </div>

                        {/* Step 2: Documents */}
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${isReady ? "bg-green-500 text-white" : "bg-blue-100 text-blue-600 border-2 border-blue-300"
                                }`}>
                                {isReady ? "✓" : "2"}
                            </div>
                            <div className="flex-1">
                                <div className="font-medium text-[#183b56]">Documents Verified</div>
                                <div className="text-xs text-[#64748b]">{verifiedCount}/3 documents verified</div>
                            </div>
                            {!isReady && (
                                <div className="flex gap-1">
                                    {['passport', 'biometric_photo', 'diploma'].map(type => (
                                        <span key={type} className={`w-2 h-2 rounded-full ${docStatus(type) === 'verified' ? 'bg-green-500' :
                                            docStatus(type) === 'verifying' ? 'bg-blue-500' : 'bg-gray-300'
                                            }`} />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Step 3: Payment */}
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${inQueue ? "bg-green-500 text-white" : "bg-gray-100 text-gray-400 border-2 border-gray-200"
                                }`}>
                                {inQueue ? "✓" : "3"}
                            </div>
                            <div>
                                <div className="font-medium text-[#183b56]">Profile Activated</div>
                                <div className="text-xs text-[#64748b]">{inQueue ? "Searching for jobs" : "Activate to start job search"}</div>
                            </div>
                        </div>

                        {/* Step 4: Job Found */}
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${candidate?.status === "OFFER_ACCEPTED" ? "bg-green-500 text-white" :
                                hasPendingOffer ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-400 border-2 border-gray-200"
                                }`}>
                                {candidate?.status === "OFFER_ACCEPTED" ? "✓" : hasPendingOffer ? "!" : "4"}
                            </div>
                            <div>
                                <div className="font-medium text-[#183b56]">Job Found</div>
                                <div className="text-xs text-[#64748b]">
                                    {candidate?.status === "OFFER_ACCEPTED" ? "Congratulations!" :
                                        hasPendingOffer ? "Review your offer" : "We'll notify you when matched"}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Payment Card (if ready but not in queue) */}
                {isReady && !inQueue && (
                    <div className="mb-8">
                        <div className="bg-white rounded-xl p-8 shadow-sm border-2 border-amber-300 relative overflow-hidden">
                            <div className="absolute top-0 right-0 bg-amber-500 text-white px-4 py-1 text-[11px] font-bold uppercase tracking-widest rounded-bl-lg">
                                🚧 Coming Soon
                            </div>

                            <h2 className="text-xl font-bold text-[#183b56] mb-2">Activate Job Search</h2>
                            <p className="text-gray-600 text-[14px] leading-relaxed mb-4">
                                Your documents are verified! This feature will be available soon.
                                <br />
                                <span className="font-semibold text-[#183b56]">We&apos;ll notify you when job matching is ready.</span>
                            </p>

                            <div className="text-[#64748b] text-sm">
                                ⏳ Stay tuned - we&apos;re working on connecting you with employers!
                            </div>
                        </div>
                    </div>
                )}

                <div className="text-center mt-12 pb-10">
                    <p className="text-[12px] text-[#94a3b8] font-medium">Worker ID: {user.email}</p>
                </div>
            </div>
        </>
    );
}
