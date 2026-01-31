"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { StepTracker } from "@/components/dashboard/StepTracker";
import { Button } from "@/components/ui/Button";
import { AlertCircle, Upload } from "lucide-react";

// Mock Data Type
interface UserData {
    name: string;
    email: string;
    status: "NEW" | "DOCS REQUESTED" | "DOCS_RECEIVED" | "UNDER REVIEW" | "APPROVED" | "PAYMENT REQUESTED" | "REJECTED";
    hasDocs: boolean;
}

export default function Dashboard() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<UserData | null>(null);

    useEffect(() => {
        // TODO: Phase 3 - Replace with real API call
        // Simulating API fetch
        const mockFetch = async () => {
            await new Promise((resolve) => setTimeout(resolve, 1000));

            // Mock User
            // Change status here to test different states
            const mockUser: UserData = {
                name: "Candidate One",
                email: "candidate@example.com",
                status: "DOCS REQUESTED",
                hasDocs: false,
            };

            setUser(mockUser);
            setLoading(false);
        };

        mockFetch();
    }, [router]);

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col font-sans">
                <Header />
                <main className="flex-1 flex items-center justify-center bg-[#f4f6fb]">
                    <div className="text-primary font-semibold animate-pulse">Loading your dashboard...</div>
                </main>
                <Footer />
            </div>
        );
    }

    if (!user) return null;

    // Status Logic Mapping
    const getStepNumber = (status: UserData["status"]) => {
        const steps: Record<string, number> = {
            'NEW': 1,
            'DOCS REQUESTED': 2,
            'DOCS_RECEIVED': 2,
            'UNDER REVIEW': 3,
            'APPROVED': 4,
            'PAYMENT REQUESTED': 4
        };
        return steps[status] || 1;
    };

    const currentStep = getStepNumber(user.status);

    return (
        <div className="min-h-screen flex flex-col font-sans bg-[#f4f6fb]">
            <Header />

            <main className="flex-1 py-10 px-5">
                <div className="container mx-auto max-w-[600px]">

                    <div className="mb-6">
                        <h1 className="text-2xl font-bold text-primary">Hello, {user.name.split(' ')[0]}</h1>
                        <p className="text-sm text-muted">Here is the live status of your application.</p>
                    </div>

                    {/* Action Required Card */}
                    {user.status === 'DOCS REQUESTED' && !user.hasDocs && (
                        <div className="bg-white border-2 border-amber-400 rounded-2xl p-6 mb-6 text-center shadow-sm">
                            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3 text-amber-600">
                                <Upload size={24} />
                            </div>
                            <h3 className="font-bold text-lg text-primary mb-2">Documents Missing</h3>
                            <p className="text-sm text-muted mb-4">We need your Passport, CV, or Diploma to proceed.</p>
                            <Button href="/upload" className="w-full justify-center">
                                Upload Documents Now
                            </Button>
                        </div>
                    )}

                    {/* Documents Received Card */}
                    {user.status === 'DOCS REQUESTED' && user.hasDocs && (
                        <div className="bg-white border border-border rounded-2xl p-6 mb-6 text-center shadow-sm">
                            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 text-green-600">
                                <Check size={24} />
                            </div>
                            <h3 className="font-bold text-lg text-primary mb-2">Documents Received!</h3>
                            <p className="text-sm text-muted">We have received your files. Waiting for admin approval.</p>
                        </div>
                    )}

                    {/* Timeline Card */}
                    <div className="bg-white rounded-2xl p-6 shadow-soft border border-border">
                        <StepTracker currentStep={currentStep} />
                    </div>

                    <div className="text-center mt-8">
                        <p className="text-xs text-muted/60">Worker ID: {user.email}</p>
                    </div>

                </div>
            </main>

            <Footer />
        </div>
    );
}

import { Check } from "lucide-react";
