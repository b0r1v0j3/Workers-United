"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ADMIN_ROLE_COOKIE, type AdminRole } from "@/lib/admin";

export default function SelectRolePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [email, setEmail] = useState<string>("");

    useEffect(() => {
        checkAuth();
    }, []);

    async function checkAuth() {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            router.push("/login");
            return;
        }

        setEmail(user.email || "");
        setLoading(false);
    }

    function selectRole(role: AdminRole) {
        // Set cookie for 7 days
        document.cookie = `${ADMIN_ROLE_COOKIE}=${role}; path=/; max-age=${7 * 24 * 60 * 60}`;

        if (role === "employer") {
            router.push("/employer/profile");
        } else {
            router.push("/profile");
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-gray-500">Loading...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-lg w-full">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-full text-sm font-medium mb-4">
                        <span>🔮</span>
                        God Mode Active
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">
                        Select Your Role
                    </h1>
                    <p className="text-gray-600">
                        Logged in as <strong>{email}</strong>
                    </p>
                </div>

                {/* Role Selection Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Candidate Card */}
                    <button
                        onClick={() => selectRole("candidate")}
                        className="group p-6 bg-white rounded-2xl border-2 border-gray-200 hover:border-blue-500 hover:shadow-lg transition-all text-left"
                    >
                        <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform">
                            👷
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            Enter as Candidate
                        </h3>
                        <p className="text-sm text-gray-600">
                            View the worker dashboard, upload documents, and track verification status.
                        </p>
                        <div className="mt-4 inline-flex items-center text-blue-600 font-medium text-sm">
                            Go to Dashboard →
                        </div>
                    </button>

                    {/* Employer Card */}
                    <button
                        onClick={() => selectRole("employer")}
                        className="group p-6 bg-white rounded-2xl border-2 border-gray-200 hover:border-teal-500 hover:shadow-lg transition-all text-left"
                    >
                        <div className="w-16 h-16 bg-teal-100 rounded-2xl flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform">
                            🏢
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            Enter as Employer
                        </h3>
                        <p className="text-sm text-gray-600">
                            View verified candidates, post job requests, and manage hiring.
                        </p>
                        <div className="mt-4 inline-flex items-center text-teal-600 font-medium text-sm">
                            Go to Employer Portal →
                        </div>
                    </button>
                </div>

                {/* Info Note */}
                <div className="mt-6 p-4 bg-gray-100 rounded-xl text-center">
                    <p className="text-sm text-gray-600">
                        Your selection will be remembered for this session.
                        <br />
                        Sign out to reset.
                    </p>
                </div>
            </div>
        </div>
    );
}
