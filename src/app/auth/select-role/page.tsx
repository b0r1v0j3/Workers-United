"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Briefcase, HardHat } from "lucide-react";

export default function SelectRolePage() {
    const [loading, setLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const supabase = createClient();

    const handleSelectRole = async (role: "worker" | "employer") => {
        setLoading(role);
        setError(null);

        try {
            // Update user metadata with selected role
            const { error: updateError } = await supabase.auth.updateUser({
                data: {
                    user_type: role,
                    gdpr_consent: true,
                    gdpr_consent_at: new Date().toISOString(),
                },
            });

            if (updateError) {
                setError(updateError.message);
                setLoading(null);
                return;
            }

            // Create profile record
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setError("Session expired. Please sign in again.");
                setLoading(null);
                return;
            }

            // Check if profile exists
            const { data: existingProfile } = await supabase
                .from("profiles")
                .select("id")
                .eq("id", user.id)
                .single();

            if (!existingProfile) {
                await supabase.from("profiles").insert({
                    id: user.id,
                    email: user.email,
                    user_type: role,
                });
            }

            if (role === "employer") {
                // Create employer record
                const { data: existingEmployer } = await supabase
                    .from("employers")
                    .select("id")
                    .eq("profile_id", user.id)
                    .single();

                if (!existingEmployer) {
                    await supabase.from("employers").insert({
                        profile_id: user.id,
                        company_name: null,
                        status: "pending",
                    });
                }

                router.push("/profile/employer");
            } else {
                router.push("/profile/worker");
            }
            router.refresh();
        } catch {
            setError("Something went wrong. Please try again.");
            setLoading(null);
        }
    };

    return (
        <div className="min-h-screen bg-[#f0f2f5] flex flex-col items-center justify-center p-6 font-montserrat">
            {/* Header */}
            <div className="mb-10 text-center">
                <Image src="/logo.png" alt="Workers United" width={64} height={64} className="mx-auto mb-4" />
                <h1 className="text-3xl font-bold text-[#1e293b] mb-2 tracking-tight">Welcome to Workers United</h1>
                <p className="text-[#64748b] text-lg font-medium">How would you like to use the platform?</p>
            </div>

            {/* Error */}
            {error && (
                <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm font-medium mb-6 max-w-md w-full text-center">
                    {error}
                </div>
            )}

            {/* Role Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl w-full">
                {/* Worker Card */}
                <button
                    onClick={() => handleSelectRole("worker")}
                    disabled={loading !== null}
                    className="group bg-white rounded-2xl p-8 shadow-sm border border-transparent hover:border-[#2563EB] hover:shadow-lg transition-all duration-200 text-left disabled:opacity-60 disabled:pointer-events-none"
                >
                    <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center mb-5 group-hover:bg-blue-100 transition-colors">
                        <HardHat className="w-7 h-7 text-[#2563EB]" />
                    </div>
                    <h2 className="text-xl font-bold text-[#1e293b] mb-2">I&apos;m a Worker</h2>
                    <p className="text-[#64748b] text-sm leading-relaxed">
                        Looking for verified employment opportunities in Europe with full visa support.
                    </p>
                    {loading === "worker" && (
                        <div className="mt-4 flex items-center gap-2 text-[#2563EB] text-sm font-semibold">
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Setting up your profile...
                        </div>
                    )}
                </button>

                {/* Employer Card */}
                <button
                    onClick={() => handleSelectRole("employer")}
                    disabled={loading !== null}
                    className="group bg-white rounded-2xl p-8 shadow-sm border border-transparent hover:border-[#0d9488] hover:shadow-lg transition-all duration-200 text-left disabled:opacity-60 disabled:pointer-events-none"
                >
                    <div className="w-14 h-14 bg-teal-50 rounded-xl flex items-center justify-center mb-5 group-hover:bg-teal-100 transition-colors">
                        <Briefcase className="w-7 h-7 text-[#0d9488]" />
                    </div>
                    <h2 className="text-xl font-bold text-[#1e293b] mb-2">I&apos;m an Employer</h2>
                    <p className="text-[#64748b] text-sm leading-relaxed">
                        Hire pre-verified international workers. We handle all documentation and visa processing.
                    </p>
                    {loading === "employer" && (
                        <div className="mt-4 flex items-center gap-2 text-[#0d9488] text-sm font-semibold">
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Setting up your profile...
                        </div>
                    )}
                </button>
            </div>

            {/* Footer note */}
            <p className="mt-8 text-[#94a3b8] text-xs text-center max-w-md">
                By continuing, you agree to our{" "}
                <a href="/terms" className="text-[#2563EB] hover:underline">Terms of Service</a>
                {" "}and{" "}
                <a href="/privacy-policy" className="text-[#2563EB] hover:underline">Privacy Policy</a>.
            </p>
        </div>
    );
}
