"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

interface Document {
    document_type: string;
    verification_status: string;
}

interface Candidate {
    job_search_active: boolean;
    job_search_activated_at: string | null;
}

// Mandatory documents for European work eligibility
const REQUIRED_DOCS = ["passport", "biometric_photo", "diploma"];

export default function VisaReadiness() {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [candidate, setCandidate] = useState<Candidate | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        const supabase = createClient();
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: candidateData } = await supabase
                .from("candidates")
                .select("id, job_search_active, job_search_activated_at")
                .eq("profile_id", user.id)
                .single();

            if (candidateData) {
                setCandidate(candidateData);

                const { data: docs } = await supabase
                    .from("documents")
                    .select("document_type, verification_status")
                    .eq("candidate_id", candidateData.id);

                setDocuments(docs || []);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    // Check if all required documents are verified
    const verifiedDocs = documents.filter(
        d => REQUIRED_DOCS.includes(d.document_type) && d.verification_status === "verified"
    );
    const isEligible = verifiedDocs.length === REQUIRED_DOCS.length;
    const hasStarted = documents.length > 0;
    const isSearchActive = candidate?.job_search_active === true;

    if (loading) {
        return (
            <div className="card animate-pulse">
                <div className="h-16 bg-gray-200 rounded"></div>
            </div>
        );
    }

    // Active Job Search Status
    if (isSearchActive) {
        return (
            <div className="card border-2 border-teal-500 bg-gradient-to-r from-teal-50 to-white">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-teal-100 flex items-center justify-center">
                        <div className="relative">
                            <span className="text-2xl">🔍</span>
                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                        </div>
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">European Work Eligibility</h3>
                        <p className="text-teal-700 font-medium">
                            Active Search – Matching with Employers
                        </p>
                    </div>
                    <Link
                        href="/profile/matches"
                        className="btn btn-secondary text-sm"
                    >
                        View Matches
                    </Link>
                </div>
            </div>
        );
    }

    // Document verification status
    return (
        <div className={`card border-2 ${isEligible ? 'border-green-200 bg-green-50/30' : 'border-gray-200'}`}>
            <div className="flex items-center gap-4">
                {/* Status Icon */}
                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl ${isEligible ? 'bg-green-100' : 'bg-slate-100'
                    }`}>
                    {isEligible ? '✓' : '🇪🇺'}
                </div>

                {/* Status Content */}
                <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">European Work Eligibility</h3>
                    {isEligible ? (
                        <p className="text-green-700 font-medium">
                            Status: Verified & Eligible for Placement
                        </p>
                    ) : hasStarted ? (
                        <p className="text-slate-600">
                            Status: Expert Compliance Check in Progress
                        </p>
                    ) : (
                        <p className="text-gray-500">
                            Status: Documents Required
                        </p>
                    )}
                </div>

                {/* Action */}
                <Link
                    href="/profile/documents"
                    className={`btn text-sm ${isEligible ? 'btn-primary' : 'btn-secondary'}`}
                >
                    {isEligible ? 'Start Job Search' : 'Complete Profile'}
                </Link>
            </div>

            {/* Progress indicator for non-eligible */}
            {!isEligible && hasStarted && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                        <span>Document verification</span>
                        <span>{verifiedDocs.length} of {REQUIRED_DOCS.length} complete</span>
                    </div>
                    <div className="bg-gray-200 rounded-full h-2">
                        <div
                            className="bg-teal-500 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${(verifiedDocs.length / REQUIRED_DOCS.length) * 100}%` }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
