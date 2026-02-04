"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface DeleteUserButtonProps {
    userId: string;
    userName: string;
}

export function DeleteUserButton({ userId, userName }: DeleteUserButtonProps) {
    const [loading, setLoading] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const router = useRouter();

    const handleDelete = async () => {
        setLoading(true);
        try {
            const response = await fetch("/api/admin/delete-user", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId }),
            });

            const data = await response.json();

            if (!response.ok) {
                alert(`Error: ${data.error}`);
                return;
            }

            alert("User deleted successfully!");
            router.refresh();
        } catch (error: any) {
            alert(`Error: ${error.message}`);
        } finally {
            setLoading(false);
            setShowConfirm(false);
        }
    };

    if (showConfirm) {
        return (
            <div className="flex gap-1">
                <button
                    onClick={handleDelete}
                    disabled={loading}
                    className="bg-red-600 text-white px-2 py-1 rounded text-[11px] font-bold hover:bg-red-700 disabled:opacity-50"
                >
                    {loading ? "..." : "Yes"}
                </button>
                <button
                    onClick={() => setShowConfirm(false)}
                    className="bg-gray-200 text-gray-700 px-2 py-1 rounded text-[11px] font-bold hover:bg-gray-300"
                >
                    No
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={() => setShowConfirm(true)}
            className="bg-white border border-red-200 text-red-600 px-3 py-1.5 rounded-lg text-[12px] font-bold hover:bg-red-50 transition-colors"
        >
            Delete
        </button>
    );
}
