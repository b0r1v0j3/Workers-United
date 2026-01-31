"use client";

import { Clock, CheckCircle, FileText, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";

// Mock Requests
const requests = [
    {
        id: 101,
        title: "Electrician (5 Workers)",
        location: "Frankfurt",
        status: "PROCESSING", // NEW, PROCESSING, REVIEW_READY, COMPLETED
        date: "2023-10-25",
    },
    {
        id: 102,
        title: "Welder (2 Workers)",
        location: "Berlin",
        status: "REVIEW_READY",
        date: "2023-10-20",
    },
];

export function RequestStatus() {
    const getStatusInfo = (status: string) => {
        switch (status) {
            case "PROCESSING":
                return { color: "bg-blue-100 text-blue-700", icon: Clock, label: "Agency Searching" };
            case "REVIEW_READY":
                return { color: "bg-green-100 text-green-700", icon: CheckCircle, label: "Candidates Found" };
            case "COMPLETED":
                return { color: "bg-gray-100 text-gray-700", icon: UserCheck, label: "Hiring Complete" };
            default:
                return { color: "bg-gray-100 text-gray-500", icon: FileText, label: "Request Received" };
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-bold text-gray-900">Your Job Requests</h2>
                <span className="text-sm text-gray-500">Live Status</span>
            </div>

            {requests.map((r) => {
                const info = getStatusInfo(r.status);
                const Icon = info.icon;

                return (
                    <div key={r.id} className="bg-white rounded-xl p-5 border border-border shadow-sm flex flex-col md:flex-row md:items-center gap-4">

                        {/* Icon Box */}
                        <div className={cn("w-12 h-12 rounded-full flex items-center justify-center shrink-0", info.color)}>
                            <Icon size={20} />
                        </div>

                        {/* Details */}
                        <div className="flex-1">
                            <h3 className="font-bold text-gray-900">{r.title}</h3>
                            <p className="text-sm text-muted">Posted on {r.date} • {r.location}</p>
                        </div>

                        {/* Status Badge */}
                        <div className="md:text-right">
                            <span className={cn("px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide", info.color)}>
                                {info.label}
                            </span>
                            {r.status === "REVIEW_READY" && (
                                <p className="text-xs text-green-600 mt-2 font-medium">Agency has found matches.<br />Please check your email.</p>
                            )}
                            {r.status === "PROCESSING" && (
                                <p className="text-xs text-blue-600 mt-2 font-medium">We are screening candidates.</p>
                            )}
                        </div>

                    </div>
                );
            })}

            {requests.length === 0 && (
                <div className="text-center py-10 bg-white rounded-xl border border-dashed border-gray-300">
                    <p className="text-gray-500">No active job requests.</p>
                </div>
            )}

        </div>
    );
}
