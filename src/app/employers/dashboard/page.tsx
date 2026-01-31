"use client";

import { EmployerLayout } from "@/components/employer/EmployerLayout";
import { CompanyProfileForm } from "@/components/employer/CompanyProfileForm";
import { RequestStatus } from "@/components/employer/RequestStatus";
import { DocumentVault } from "@/components/employer/DocumentVault";

export default function EmployerDashboard() {
    return (
        <EmployerLayout>
            <div className="space-y-8">

                {/* Welcome Section */}
                <div className="bg-gradient-to-r from-indigo-900 to-[#1e40af] rounded-2xl p-8 text-white relative overflow-hidden">
                    <div className="relative z-10">
                        <h1 className="text-2xl font-bold mb-2">BuildCorp Service Portal</h1>
                        <p className="opacity-90 max-w-xl">Manage your hiring requests, view visa status, and upload compliance documents.</p>
                    </div>
                    {/* Decorative circle */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full translate-x-20 -translate-y-20 blur-3xl pointer-events-none"></div>
                </div>

                {/* Main Grid */}
                <div className="grid lg:grid-cols-[1.5fr_1fr] gap-8">

                    {/* Left: Profile & Needs */}
                    <div className="space-y-8">
                        <CompanyProfileForm />
                    </div>

                    {/* Right: Status & Docs */}
                    <div className="space-y-8">
                        <RequestStatus />
                        <DocumentVault />
                    </div>

                </div>

            </div>
        </EmployerLayout>
    );
}
