"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

interface DeleteUserButtonProps {
    userId: string;
    userName: string;
}

export function DeleteUserButton({ userId, userName }: DeleteUserButtonProps) {
    const [loading, setLoading] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
    const router = useRouter();

    const handleDelete = async () => {
        setLoading(true);
        setStatus(null);
        try {
            const response = await fetch("/api/admin/delete-user", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId }),
            });

            const data = await response.json();

            if (!response.ok) {
                setStatus({ type: "error", msg: data.error || "Failed to delete user." });
                return;
            }

            setStatus({ type: "success", msg: "User deleted successfully!" });
            setTimeout(() => router.refresh(), 1500);
        } catch (error) {
            setStatus({ type: "error", msg: error instanceof Error ? error.message : "An error occurred." });
        } finally {
            setLoading(false);
            setShowConfirm(false);
        }
    };

    if (status) {
        return (
            <span className={`text-[11px] font-bold px-2 py-1 rounded ${status.type === "success" ? "text-green-700 bg-green-50" : "text-red-700 bg-red-50"}`}>
                {status.msg}
            </span>
        );
    }

    if (showConfirm) {
        return (
            <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-2 py-1">
                <span className="text-[10px] font-bold text-red-700">Delete {userName.split(' ')[0]}?</span>
                <button
                    onClick={handleDelete}
                    disabled={loading}
                    className="bg-red-600 text-white px-2 py-0.5 rounded text-[10px] font-bold hover:bg-red-700 disabled:opacity-50"
                >
                    {loading ? "..." : "Yes"}
                </button>
                <button
                    onClick={() => setShowConfirm(false)}
                    className="bg-white text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold hover:bg-slate-100 border border-slate-200"
                >
                    No
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={() => setShowConfirm(true)}
            title={`Delete ${userName}`}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
        >
            <Trash2 size={15} />
        </button>
    );
}

