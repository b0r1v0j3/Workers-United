"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ApplicationDataForm from "@/components/ApplicationDataForm";
import { ApplicationData } from "@/types/application";

export default function ApplicationPage() {
    const [loading, setLoading] = useState(true);
    const [initialData, setInitialData] = useState<ApplicationData | undefined>(undefined);

    useEffect(() => {
        async function loadData() {
            try {
                const res = await fetch("/api/application-data");
                const json = await res.json();
                if (json.data) {
                    setInitialData(json.data);
                }
            } catch (e) {
                console.error("Failed to load application data:", e);
            }
            setLoading(false);
        }
        loadData();
    }, []);

    const handleSave = async (data: ApplicationData) => {
        const res = await fetch("/api/application-data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            throw new Error("Failed to save");
        }
    };

    return (
        <div className="min-h-screen bg-[#f1f5f9] font-montserrat">
            {/* Header */}
            <nav className="bg-[#183b56] px-5 py-4 flex justify-between items-center shadow-lg sticky top-0 z-50">
                <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                    <img src="/logo.png" alt="Workers United" width={48} height={48} className="brightness-0 invert rounded" />
                    <span className="font-bold text-white text-lg">Workers United</span>
                </Link>
                <a href="/auth/signout" className="text-sm font-semibold hover:opacity-80 transition-colors" style={{ color: 'white' }}>
                    Logout
                </a>
            </nav>

            <div className="max-w-4xl mx-auto px-5 py-10">
                <div className="mb-8">
                    <Link href="/dashboard" className="text-[#2f6fed] font-semibold hover:underline mb-4 inline-block">
                        ← Nazad na Dashboard
                    </Link>
                    <h1 className="text-3xl font-bold text-[#183b56]">Podaci za aplikaciju</h1>
                    <p className="text-[#64748b] mt-2">
                        Popunite sledeće podatke potrebne za e-Uprava aplikaciju za radnu dozvolu.
                    </p>
                </div>

                {loading ? (
                    <div className="text-center py-20 text-[#64748b]">
                        Učitavanje...
                    </div>
                ) : (
                    <ApplicationDataForm
                        initialData={initialData}
                        onSave={handleSave}
                    />
                )}
            </div>
        </div>
    );
}
