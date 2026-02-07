"use client";

import { useState } from "react";
import Link from "next/link";
import { SignaturePad } from "@/components/SignaturePad";
import { createClient } from "@/lib/supabase/client";

interface OfferClientProps {
    offer: any;
    candidate: any;
    isExpired: boolean;
    expiresAt: string;
}

export default function OfferClient({ offer, candidate, isExpired, expiresAt }: OfferClientProps) {
    const [hasSigned, setHasSigned] = useState(!!candidate.signature_url);
    const [signing, setSigning] = useState(false);
    const [confirming, setConfirming] = useState(false);

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

            // Save signature to candidate record
            await supabase
                .from("candidates")
                .update({ signature_url: signatureData })
                .eq("id", candidate.id);

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
            <nav className="bg-white shadow-sm sticky top-0 z-50 border-b border-[#dddfe2] h-[56px]">
                <div className="max-w-[700px] mx-auto px-4 h-full flex items-center justify-between">
                    <Link href="/profile/worker" className="flex items-center gap-2 text-[#65676b] hover:text-[#050505] text-sm font-semibold">
                        ← Back to Profile
                    </Link>
                    <Link href="/" className="flex items-center gap-2">
                        <img src="/logo.png" alt="Workers United" className="h-10 w-auto object-contain" />
                        <span className="font-bold text-[#1877f2] text-xl hidden sm:inline">Workers United</span>
                    </Link>
                    <div className="w-[120px]" />
                </div>
            </nav>

            <main className="max-w-[700px] mx-auto px-4 py-6">
                {/* Status Banner */}
                {offer.status === "accepted" ? (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6 text-center">
                        <span className="text-emerald-800 font-bold flex items-center justify-center gap-2">
                            ✅ Offer Accepted — Visa Process Started
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

                    <div className="grid grid-cols-2 gap-4 mb-6">
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

                {/* Confirmation Flow — only shown for pending offers */}
                {offer.status === "pending" && !isExpired && (
                    <div className="bg-white rounded-xl shadow-sm border border-[#dddfe2] p-6 mb-4">
                        <h3 className="text-lg font-bold text-[#050505] mb-4">Confirm Your Position</h3>

                        {/* Step 1: Must sign first */}
                        <div className="mb-6">
                            <div className="flex items-center gap-3 mb-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 ${hasSigned
                                    ? 'bg-emerald-500 border-emerald-500 text-white'
                                    : 'bg-white border-[#1877f2] text-[#1877f2]'
                                    }`}>
                                    {hasSigned ? '✓' : '1'}
                                </div>
                                <h4 className="font-bold text-[#050505]">Digital Signature</h4>
                            </div>

                            {hasSigned ? (
                                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm flex items-center gap-2 ml-11">
                                    ✓ You have signed. You can proceed to payment.
                                </div>
                            ) : (
                                <div className="ml-11">
                                    <p className="text-sm text-[#65676b] mb-4">
                                        Sign below to confirm you accept this offer and agree to begin the visa application process.
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
                            )}
                        </div>

                        {/* Step 2: Pay confirmation fee */}
                        <div className="mb-6">
                            <div className="flex items-center gap-3 mb-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 ${offer.status === 'accepted'
                                    ? 'bg-emerald-500 border-emerald-500 text-white'
                                    : hasSigned
                                        ? 'bg-white border-[#1877f2] text-[#1877f2]'
                                        : 'bg-white border-[#dddfe2] text-[#bcc0c4]'
                                    }`}>
                                    2
                                </div>
                                <h4 className={`font-bold ${hasSigned ? 'text-[#050505]' : 'text-[#bcc0c4]'}`}>
                                    Confirmation Payment
                                </h4>
                            </div>

                            <div className="ml-11">
                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                                    <p className="text-blue-800 text-sm font-medium mb-2">By paying the confirmation fee, you agree to:</p>
                                    <ul className="text-blue-800 text-sm space-y-1">
                                        <li>• Begin the visa application process</li>
                                        <li>• Provide all required documentation</li>
                                        <li>• Accept the position if visa is approved</li>
                                    </ul>
                                </div>

                                <div className="flex items-center justify-between bg-[#f0f2f5] p-4 rounded-xl mb-4">
                                    <span className="text-[#65676b] font-medium">Confirmation Fee</span>
                                    <span className="text-2xl font-bold text-[#050505]">$190</span>
                                </div>

                                <button
                                    onClick={handleConfirmAndPay}
                                    disabled={!hasSigned || confirming}
                                    className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${hasSigned && !confirming
                                        ? 'bg-[#1877f2] text-white hover:bg-[#166fe5] shadow-lg shadow-blue-500/20 cursor-pointer'
                                        : 'bg-[#e4e6eb] text-[#bcc0c4] cursor-not-allowed'
                                        }`}
                                >
                                    {confirming ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                            Processing...
                                        </span>
                                    ) : hasSigned ? (
                                        "Confirm & Pay $190"
                                    ) : (
                                        "Sign first to unlock payment"
                                    )}
                                </button>

                                <p className="text-xs text-[#65676b] text-center mt-3">
                                    Payment is processed securely via Stripe
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Expired state */}
                {(offer.status === "expired" || isExpired) && offer.status !== "accepted" && (
                    <div className="bg-white rounded-xl shadow-sm border border-[#dddfe2] p-6 mb-4 text-center">
                        <p className="text-[#65676b] mb-4">
                            This offer has expired and was transferred to the next candidate.
                        </p>
                        <Link href="/profile/worker" className="bg-[#1877f2] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#166fe5] transition-colors inline-block">
                            Back to Profile
                        </Link>
                    </div>
                )}

                {/* Accepted state */}
                {offer.status === "accepted" && (
                    <div className="bg-white rounded-xl shadow-sm border border-[#dddfe2] p-6 mb-4 text-center">
                        <p className="text-[#65676b] mb-4">
                            Your visa application process has started. We will contact you with next steps.
                        </p>
                        <Link href="/profile/worker" className="bg-[#1877f2] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#166fe5] transition-colors inline-block">
                            Go to Profile
                        </Link>
                    </div>
                )}
            </main>
        </div>
    );
}
