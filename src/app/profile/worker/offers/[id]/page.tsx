import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

interface OfferPageProps {
    params: Promise<{ id: string }>;
}

export default async function OfferDetailPage({ params }: OfferPageProps) {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    // Get offer with related data
    const { data: offer, error } = await supabase
        .from("offers")
        .select(`
      *,
      candidates(*),
      job_requests(*, employers(*, profiles(*)))
    `)
        .eq("id", id)
        .single();

    if (error || !offer) {
        notFound();
    }

    // Verify this offer belongs to the current user
    const { data: candidate } = await supabase
        .from("candidates")
        .select("id")
        .eq("profile_id", user.id)
        .single();

    if (!candidate || offer.candidate_id !== candidate.id) {
        redirect("/profile/worker");
    }

    const expiresAt = new Date(offer.expires_at);
    const now = new Date();
    const isExpired = expiresAt < now;
    const hoursRemaining = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60)));
    const minutesRemaining = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60)) % 60);

    const jobRequest = offer.job_requests;
    const employer = jobRequest?.employers;

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <nav className="bg-white border-b border-gray-200">
                <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <Link href="/profile/worker/queue" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M19 12H5M12 19l-7-7 7-7" />
                            </svg>
                            Back to Queue
                        </Link>
                    </div>
                </div>
            </nav>

            <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Status Banner */}
                {offer.status === "accepted" ? (
                    <div className="bg-green-100 border border-green-300 rounded-lg p-4 mb-6 text-center">
                        <span className="text-green-800 font-semibold">
                            ✅ Offer Accepted - Visa Process Started
                        </span>
                    </div>
                ) : offer.status === "expired" || isExpired ? (
                    <div className="bg-red-100 border border-red-300 rounded-lg p-4 mb-6 text-center">
                        <span className="text-red-800 font-semibold">
                            ❌ This offer has expired
                        </span>
                    </div>
                ) : (
                    <div className="bg-amber-100 border border-amber-300 rounded-lg p-4 mb-6">
                        <div className="flex justify-between items-center">
                            <span className="text-amber-800 font-semibold">
                                ⏰ Time Remaining to Confirm
                            </span>
                            <span className="text-2xl font-bold text-amber-900">
                                {hoursRemaining}h {minutesRemaining}m
                            </span>
                        </div>
                    </div>
                )}

                {/* Job Details Card */}
                <div className="card mb-6">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">
                        {jobRequest?.title || "Position"}
                    </h1>

                    <div className="flex gap-4 text-gray-600 mb-6">
                        <span>🏢 {employer?.company_name || "Employer"}</span>
                        <span>📍 {jobRequest?.destination_country}</span>
                    </div>

                    {jobRequest?.description && (
                        <div className="mb-6">
                            <h3 className="font-semibold text-gray-900 mb-2">Job Description</h3>
                            <p className="text-gray-700">{jobRequest.description}</p>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 mb-6">
                        {jobRequest?.salary_min && (
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <div className="text-sm text-gray-500">Salary Range</div>
                                <div className="text-lg font-semibold text-gray-900">
                                    {jobRequest.salary_currency || 'EUR'} {jobRequest.salary_min}
                                    {jobRequest.salary_max && ` - ${jobRequest.salary_max}`}
                                </div>
                            </div>
                        )}
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <div className="text-sm text-gray-500">Industry</div>
                            <div className="text-lg font-semibold text-gray-900">
                                {jobRequest?.industry || "General"}
                            </div>
                        </div>
                    </div>

                    <hr className="my-6" />

                    {/* Confirmation Section */}
                    {offer.status === "pending" && !isExpired && (
                        <>
                            <h3 className="font-semibold text-gray-900 mb-4">Confirm Your Position</h3>

                            <div className="bg-blue-50 p-4 rounded-lg mb-6">
                                <p className="text-blue-800 text-sm">
                                    By paying the confirmation fee, you agree to:
                                </p>
                                <ul className="text-blue-800 text-sm mt-2 space-y-1">
                                    <li>• Begin the visa application process</li>
                                    <li>• Provide all required documentation</li>
                                    <li>• Accept the position if visa is approved</li>
                                </ul>
                            </div>

                            <div className="flex items-center justify-between bg-gray-100 p-4 rounded-lg mb-6">
                                <span className="text-gray-700 font-medium">Confirmation Fee</span>
                                <span className="text-2xl font-bold text-gray-900">$190</span>
                            </div>

                            <ConfirmOfferButton offerId={id} />

                            <p className="text-xs text-gray-500 text-center mt-4">
                                Payment is processed securely via Stripe
                            </p>
                        </>
                    )}

                    {(offer.status === "expired" || isExpired) && offer.status !== "accepted" && (
                        <div className="text-center py-4">
                            <p className="text-gray-600 mb-4">
                                This offer has expired and was transferred to the next candidate.
                            </p>
                            <Link href="/profile/worker/queue" className="btn btn-primary">
                                View Your Queue Status
                            </Link>
                        </div>
                    )}

                    {offer.status === "accepted" && (
                        <div className="text-center py-4">
                            <p className="text-gray-600 mb-4">
                                Your visa application process has started. We will contact you with next steps.
                            </p>
                            <Link href="/profile/worker" className="btn btn-primary">
                                Go to Dashboard
                            </Link>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

function ConfirmOfferButton({ offerId }: { offerId: string }) {
    async function confirmOffer() {
        "use server";

        const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/stripe/create-checkout`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "confirmation_fee", offerId }),
        });

        const data = await response.json();

        if (data.checkoutUrl) {
            redirect(data.checkoutUrl);
        }
    }

    return (
        <form action={confirmOffer}>
            <button
                type="submit"
                className="btn btn-primary w-full text-lg py-4"
            >
                Confirm & Pay $190
            </button>
        </form>
    );
}
