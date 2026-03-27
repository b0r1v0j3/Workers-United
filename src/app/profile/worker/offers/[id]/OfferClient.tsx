"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { SignaturePad } from "@/components/SignaturePad";
import {
    getOfferCheckoutCta,
    OFFER_CHECKOUT_HELP_TEXT,
    OFFER_CHECKOUT_SUMMARY_LABEL,
    OFFER_CHECKOUT_SUMMARY_VALUE,
} from "@/lib/offer-checkout-copy";
import { createClient } from "@/lib/supabase/client";

interface OfferClientWorkerRecord {
    id: string;
    signature_url?: string | null;
}

interface OfferClientJobRequest {
    title?: string | null;
    description?: string | null;
    destination_country?: string | null;
    industry?: string | null;
    salary_rsd?: number | null;
    salary_min?: number | null;
    salary_max?: number | null;
    salary_currency?: string | null;
    employers?: {
        company_name?: string | null;
    } | null;
}

interface OfferClientOffer {
    id: string;
    status: string;
    job_requests?: OfferClientJobRequest | null;
}

interface OfferClientProps {
    offer: OfferClientOffer;
    workerRecord: OfferClientWorkerRecord;
    isExpired: boolean;
    expiresAt: string;
}

export default function OfferClient({ offer, workerRecord, isExpired, expiresAt }: OfferClientProps) {
    const [hasSigned, setHasSigned] = useState(!!workerRecord.signature_url);
    const [signing, setSigning] = useState(false);
    const [confirming, setConfirming] = useState(false);

    const isPaid = offer.status === "accepted";
    const needsSignature = isPaid && !hasSigned;

    const expiresDate = new Date(expiresAt);
    const now = new Date();
    const hoursRemaining = Math.max(0, Math.floor((expiresDate.getTime() - now.getTime()) / (1000 * 60 * 60)));
    const minutesRemaining = Math.max(0, Math.floor((expiresDate.getTime() - now.getTime()) / (1000 * 60)) % 60);

    const jobRequest = offer.job_requests;
    const employer = jobRequest?.employers;

    const handleSignatureSave = async (signatureData: string) => {
        setSigning(true);
        try {
            const supabase = createClient();

            // Save signature to the worker onboarding record
            await supabase
                .from("worker_onboarding")
                .update({ signature_url: signatureData })
                .eq("id", workerRecord.id);

            // Also log it via API
            await fetch("/api/signatures", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    signatureData,
                    documentType: "offer_acceptance",
                    agreedText: `I accept the offer for ${jobRequest?.title || "the position"} and agree to begin the visa process.`
                }),
            });

            setHasSigned(true);
        } catch (err) {
            console.error("Signature save failed:", err);
        } finally {
            setSigning(false);
        }
    };

    const handleConfirmAndPay = async () => {
        setConfirming(true);
        try {
            const response = await fetch("/api/stripe/create-checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "confirmation_fee", offerId: offer.id }),
            });

            const data = await response.json();

            if (data.checkoutUrl) {
                window.location.href = data.checkoutUrl;
            }
        } catch (err) {
            console.error("Payment failed:", err);
        } finally {
            setConfirming(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f0f2f5]">
            {/* Header */}
            <nav className="bg-white shadow-sm sticky top-0 z-50 border-b border-[#dddfe2] h-[62px]">
                <div className="max-w-[700px] mx-auto px-4 h-full flex items-center justify-between">
                    <Link href="/profile/worker" className="flex items-center gap-2 text-[#65676b] hover:text-[#050505] text-sm font-semibold">
                        ← Back to Profile
                    </Link>
                    <Link href="/" className="inline-flex items-center">
                        <Image
                            src="/logo-complete-transparent.png"
                            alt="Workers United logo"
                            width={196}
                            height={196}
                            className="h-auto w-[140px] object-contain sm:w-[156px]"
                        />
                    </Link>
                    <div className="w-[120px]" />
                </div>
            </nav>

            <main className="max-w-[700px] mx-auto px-4 py-6">
                {/* Status Banner */}
                {isPaid && hasSigned ? (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6 text-center">
                        <span className="text-emerald-800 font-bold flex items-center justify-center gap-2">
                            ✅ Offer Accepted — Visa Process Started
                        </span>
                    </div>
                ) : isPaid && !hasSigned ? (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-center">
                        <span className="text-blue-800 font-bold flex items-center justify-center gap-2">
                            💳 Payment received — Please sign below to finalize
                        </span>
                    </div>
                ) : offer.status === "expired" || isExpired ? (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-center">
                        <span className="text-red-800 font-bold">
                            ❌ This offer has expired
                        </span>
                    </div>
                ) : (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                        <div className="flex justify-between items-center">
                            <span className="text-amber-800 font-bold">
                                ⏰ Time Remaining
                            </span>
                            <span className="text-2xl font-bold text-amber-900">
                                {hoursRemaining}h {minutesRemaining}m
                            </span>
                        </div>
                    </div>
                )}

                {/* Job Details Card */}
                <div className="bg-white rounded-xl shadow-sm border border-[#dddfe2] p-6 mb-4">
                    <h1 className="text-2xl font-bold text-[#050505] mb-2">
                        {jobRequest?.title || "Position"}
                    </h1>

                    <div className="flex gap-4 text-[#65676b] mb-6">
                        <span>🏢 {employer?.company_name || "Employer"}</span>
                        <span>📍 {jobRequest?.destination_country}</span>
                    </div>

                    {jobRequest?.description && (
                        <div className="mb-6">
                            <h3 className="font-bold text-[#050505] mb-2">Job Description</h3>
                            <p className="text-[#65676b]">{jobRequest.description}</p>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        {jobRequest?.salary_rsd && (
                            <div className="bg-[#f0f2f5] p-4 rounded-xl">
                                <div className="text-xs font-semibold text-[#65676b] uppercase tracking-wide">Salary</div>
                                <div className="text-lg font-bold text-[#050505]">
                                    {jobRequest.salary_rsd.toLocaleString()} RSD/month
                                </div>
                            </div>
                        )}
                        <div className="bg-[#f0f2f5] p-4 rounded-xl">
                            <div className="text-xs font-semibold text-[#65676b] uppercase tracking-wide">Industry</div>
                            <div className="text-lg font-bold text-[#050505]">
                                {jobRequest?.industry || "General"}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ═══════════ STEP 1: PAY (for pending offers) ═══════════ */}
                {offer.status === "pending" && !isExpired && (
                    <div className="bg-white rounded-xl shadow-sm border border-[#dddfe2] p-6 mb-4">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 bg-white border-[#1877f2] text-[#1877f2]">
                                1
                            </div>
                            <h3 className="text-lg font-bold text-[#050505]">Confirm & Continue</h3>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                            <p className="text-blue-800 text-sm font-medium mb-2">By continuing to secure checkout, you agree to:</p>
                            <ul className="text-blue-800 text-sm space-y-1">
                                <li>• Begin the visa application process</li>
                                <li>• Provide all required documentation</li>
                                <li>• Accept the position if visa is approved</li>
                            </ul>
                        </div>

                        <div className="flex items-center justify-between bg-[#f0f2f5] p-4 rounded-xl mb-4">
                            <span className="text-[#65676b] font-medium">{OFFER_CHECKOUT_SUMMARY_LABEL}</span>
                            <span className="text-lg text-right font-bold text-[#050505]">{OFFER_CHECKOUT_SUMMARY_VALUE}</span>
                        </div>

                        <button
                            onClick={handleConfirmAndPay}
                            disabled={confirming}
                            className="w-full py-4 rounded-xl font-bold text-lg transition-all bg-[#1877f2] text-white hover:bg-[#166fe5] shadow-lg shadow-blue-500/20 disabled:opacity-50"
                        >
                            {confirming ? (
                                <span className="flex items-center justify-center gap-2">
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                    Redirecting to payment...
                                </span>
                            ) : (
                                getOfferCheckoutCta("page")
                            )}
                        </button>

                        <p className="text-xs text-[#65676b] text-center mt-3">
                            {OFFER_CHECKOUT_HELP_TEXT} After payment you&apos;ll sign to finalize.
                        </p>
                    </div>
                )}

                {/* ═══════════ STEP 2: SIGN (after payment) ═══════════ */}
                {needsSignature && (
                    <div className="bg-white rounded-xl shadow-sm border border-[#dddfe2] p-6 mb-4">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 bg-emerald-500 border-emerald-500 text-white">
                                ✓
                            </div>
                            <h3 className="text-lg font-bold text-[#050505]">Payment Received</h3>
                        </div>
                        <p className="text-sm text-emerald-600 mb-6 ml-11">Your payment has been confirmed. One last step — sign below to finalize your acceptance.</p>

                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 bg-white border-[#1877f2] text-[#1877f2]">
                                2
                            </div>
                            <h3 className="text-lg font-bold text-[#050505]">Digital Signature</h3>
                        </div>

                        <div className="ml-11">
                            <p className="text-sm text-[#65676b] mb-4">
                                Sign below to confirm your acceptance. This is the final step before we begin the visa process.
                            </p>
                            <SignaturePad
                                onSave={handleSignatureSave}
                                agreementText={`I accept the offer for "${jobRequest?.title || "this position"}" at ${employer?.company_name || "the employer"} and agree to begin the visa process. I confirm all my information is accurate.`}
                            />
                            {signing && (
                                <div className="mt-2 text-sm text-[#65676b] flex items-center gap-2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#1877f2]"></div>
                                    Saving signature...
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ═══════════ ALL DONE (paid + signed) ═══════════ */}
                {isPaid && hasSigned && (
                    <div className="bg-white rounded-xl shadow-sm border border-[#dddfe2] p-6 mb-4 text-center">
                        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">🎉</span>
                        </div>
                        <h3 className="text-xl font-bold text-[#050505] mb-2">You&apos;re all set!</h3>
                        <p className="text-[#65676b] mb-6">
                            Your visa application process has started. We will contact you with next steps.
                        </p>
                        <Link href="/profile/worker" className="bg-[#1877f2] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#166fe5] transition-colors inline-block">
                            Go to Profile
                        </Link>
                    </div>
                )}

                {/* Expired state */}
                {(offer.status === "expired" || isExpired) && offer.status !== "accepted" && (
                    <div className="bg-white rounded-xl shadow-sm border border-[#dddfe2] p-6 mb-4 text-center">
                        <p className="text-[#65676b] mb-4">
                            This offer has expired and was transferred to the next worker.
                        </p>
                        <Link href="/profile/worker" className="bg-[#1877f2] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#166fe5] transition-colors inline-block">
                            Back to Profile
                        </Link>
                    </div>
                )}
            </main>
        </div>
    );
}
