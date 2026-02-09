"use client";

import { useState } from "react";

export function EmployerStatusButton({ employerId, currentStatus }: { employerId: string; currentStatus: string }) {
    const [status, setStatus] = useState(currentStatus);
    const [loading, setLoading] = useState(false);

    const updateStatus = async (newStatus: string) => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/employer-status", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ employerId, status: newStatus }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to update");
            setStatus(newStatus);
        } catch (err) {
            console.error("Status update failed:", err);
        } finally {
            setLoading(false);
        }
    };

    const statusStyles: Record<string, string> = {
        active: "bg-emerald-100 text-emerald-700 border border-emerald-200",
        pending: "bg-amber-100 text-amber-700 border border-amber-200",
        rejected: "bg-red-100 text-red-700 border border-red-200",
    };

    return (
        <div className="flex items-center gap-2">
            <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold uppercase ${statusStyles[status] || statusStyles.pending}`}>
                {status}
            </span>
            {loading ? (
                <span className="text-xs text-gray-400">Updating...</span>
            ) : (
                <>
                    {status !== "active" && (
                        <button
                            onClick={() => updateStatus("active")}
                            className="text-[11px] px-2.5 py-1 rounded-md font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                        >
                            Approve
                        </button>
                    )}
                    {status !== "rejected" && status !== "active" && (
                        <button
                            onClick={() => updateStatus("rejected")}
                            className="text-[11px] px-2.5 py-1 rounded-md font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors"
                        >
                            Reject
                        </button>
                    )}
                    {status === "active" && (
                        <button
                            onClick={() => updateStatus("pending")}
                            className="text-[11px] px-2.5 py-1 rounded-md font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
                        >
                            Revoke
                        </button>
                    )}
                </>
            )}
        </div>
    );
}
