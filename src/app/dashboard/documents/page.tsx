"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import DocumentWizard from "@/components/DocumentWizard";

export default function DocumentsPage() {
    const supabase = createClient();
    const [candidateId, setCandidateId] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string>("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function getCandidate() {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUserEmail(user.email || "");
                const { data: candidate } = await supabase
                    .from("candidates")
                    .select("id")
                    .eq("profile_id", user.id)
                    .single();

                if (candidate) {
                    setCandidateId(candidate.id);
                }
            }
            setLoading(false);
        }
        getCandidate();
    }, []);

    if (loading) {
        return (
            <div className="wizard-page-bg">
                <div className="text-white font-bold">Loading...</div>
            </div>
        );
    }

    if (!candidateId) {
        return (
            <div className="wizard-page-bg">
                <div className="bg-white p-10 rounded-3xl shadow-2xl text-center max-w-md">
                    <h2 className="text-2xl font-bold text-navy mb-4">Profile Required</h2>
                    <p className="text-gray-600 mb-6">You need to complete your profile before uploading documents.</p>
                    <Link href="/dashboard/profile" className="btn btn-primary">Go to Profile</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="wizard-page-bg">
            <div className="fixed top-6 left-6 z-50">
                <Link href="/dashboard" className="flex items-center gap-2 text-white hover:opacity-80 font-semibold bg-black/20 px-4 py-2 rounded-full backdrop-blur-sm">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    Back to Dashboard
                </Link>
            </div>

            <DocumentWizard
                candidateId={candidateId}
                email={userEmail}
                onComplete={() => {
                    // Could redirect back to dashboard or show success
                    console.log("Documents submitted!");
                }}
            />
        </div>
    );
}
