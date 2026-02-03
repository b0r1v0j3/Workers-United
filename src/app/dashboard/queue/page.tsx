import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function QueuePage() {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    // Get candidate with queue info
    const { data: candidate } = await supabase
        .from("candidates")
        .select("*")
        .eq("profile_id", user.id)
        .single();

    if (!candidate) {
        redirect("/dashboard");
    }

    const isInQueue = candidate.entry_fee_paid && candidate.status === "IN_QUEUE";
    const hasPendingOffer = candidate.status === "OFFER_PENDING";
    const queueJoinedDate = candidate.queue_joined_at
        ? new Date(candidate.queue_joined_at)
        : null;

    // Calculate days in queue
    const daysInQueue = queueJoinedDate
        ? Math.floor((Date.now() - queueJoinedDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

    // Check for pending offers
    const { data: pendingOffers } = await supabase
        .from("offers")
        .select(`
      *,
      job_requests(*, employers(company_name))
    `)
        .eq("candidate_id", candidate.id)
        .eq("status", "pending")
        .order("expires_at", { ascending: true });

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <nav className="bg-white border-b border-gray-200">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <Link href="/dashboard" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M19 12H5M12 19l-7-7 7-7" />
                            </svg>
                            Back to Dashboard
                        </Link>
                    </div>
                </div>
            </nav>

            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <h1 className="text-2xl font-bold text-gray-900 mb-6">Your Queue Status</h1>

                {/* Queue Status Card */}
                <div className="card mb-6">
                    {!candidate.entry_fee_paid ? (
                        // Not in queue yet
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2">
                                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                                </svg>
                            </div>
                            <h2 className="text-xl font-semibold text-gray-900 mb-2">Join the Active Queue</h2>
                            <p className="text-gray-600 mb-6 max-w-md mx-auto">
                                Pay the $9 entry fee to join the active candidate queue and become eligible for job matches.
                            </p>
                            <PayToJoinButton />
                        </div>
                    ) : hasPendingOffer ? (
                        // Has pending offer
                        <div className="text-center py-4">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                    <polyline points="22,4 12,14.01 9,11.01" />
                                </svg>
                            </div>
                            <h2 className="text-xl font-semibold text-gray-900 mb-2">🎉 You Have an Offer!</h2>
                            <p className="text-gray-600 mb-4">
                                Check below to review and confirm your job offer.
                            </p>
                        </div>
                    ) : isInQueue ? (
                        // In queue, waiting
                        <div className="text-center py-4">
                            <div className="text-6xl font-bold text-blue-600 mb-2">
                                #{candidate.queue_position}
                            </div>
                            <p className="text-gray-600 mb-4">Your position in the queue</p>

                            <div className="flex justify-center gap-8 text-sm text-gray-500">
                                <div>
                                    <span className="block text-2xl font-semibold text-gray-900">{daysInQueue}</span>
                                    Days in queue
                                </div>
                                <div>
                                    <span className="block text-2xl font-semibold text-gray-900">
                                        {90 - daysInQueue}
                                    </span>
                                    Days until refund eligibility
                                </div>
                            </div>

                            <div className="mt-6 p-4 bg-blue-50 rounded-lg text-sm text-blue-800">
                                <p>
                                    <strong>How it works:</strong> When an employer posts a job matching your profile,
                                    you&apos;ll receive an offer based on your queue position. First in queue = first to receive offers.
                                </p>
                            </div>
                        </div>
                    ) : (
                        // Other status
                        <div className="text-center py-4">
                            <p className="text-gray-600">
                                Status: <strong>{candidate.status}</strong>
                            </p>
                        </div>
                    )}
                </div>

                {/* Pending Offers */}
                {pendingOffers && pendingOffers.length > 0 && (
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold text-gray-900">Your Active Offers</h2>

                        {pendingOffers.map((offer) => (
                            <OfferCard key={offer.id} offer={offer} />
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}

function PayToJoinButton() {
    return (
        <form action="/api/stripe/create-checkout" method="POST">
            <input type="hidden" name="type" value="entry_fee" />
            <button
                type="submit"
                className="btn btn-primary"
            >
                Pay $9 to Join Queue
            </button>
        </form>
    );
}

function OfferCard({ offer }: {
    offer: {
        id: string;
        expires_at: string;
        job_requests: {
            title: string;
            destination_country: string;
            salary_min?: number;
            salary_max?: number;
            salary_currency?: string;
            employers?: { company_name: string };
        };
    }
}) {
    const expiresAt = new Date(offer.expires_at);
    const now = new Date();
    const hoursRemaining = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60)));
    const minutesRemaining = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60)) % 60);

    const isUrgent = hoursRemaining < 6;

    return (
        <div className={`card border-2 ${isUrgent ? 'border-red-500 bg-red-50' : 'border-green-500'}`}>
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                        {offer.job_requests.title}
                    </h3>
                    <p className="text-gray-600">
                        {offer.job_requests.employers?.company_name || "Employer"} • {offer.job_requests.destination_country}
                    </p>
                </div>

                <div className={`text-right ${isUrgent ? 'text-red-600' : 'text-amber-600'}`}>
                    <div className="text-2xl font-bold">
                        {hoursRemaining}h {minutesRemaining}m
                    </div>
                    <div className="text-sm">remaining</div>
                </div>
            </div>

            {offer.job_requests.salary_min && (
                <p className="text-gray-700 mb-4">
                    Salary: {offer.job_requests.salary_currency || 'EUR'} {offer.job_requests.salary_min}
                    {offer.job_requests.salary_max && ` - ${offer.job_requests.salary_max}`}
                </p>
            )}

            <div className={`p-3 rounded-lg mb-4 ${isUrgent ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                <strong>⏰ Action Required:</strong> Confirm this offer within {hoursRemaining} hours
                or it will be offered to the next candidate.
            </div>

            <Link
                href={`/dashboard/offers/${offer.id}`}
                className="btn btn-primary w-full"
            >
                Confirm Offer - Pay $190
            </Link>
        </div>
    );
}
