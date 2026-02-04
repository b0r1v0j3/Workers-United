"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ApplicationDataForm from "@/components/ApplicationDataForm";
import { ApplicationData } from "@/types/application";

interface ValidationIssue {
    field: string;
    profile_value: string;
    passport_value: string;
    message: string;
}

interface ValidationResult {
    success: boolean;
    status: string;
    message: string;
    issues: ValidationIssue[];
}

export default function ApplicationPage() {
    const [loading, setLoading] = useState(true);
    const [initialData, setInitialData] = useState<ApplicationData | undefined>(undefined);
    const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
    const [validating, setValidating] = useState(false);

    useEffect(() => {
        async function loadData() {
            try {
                const res = await fetch("/api/application-data");
                const json = await res.json();
                if (json.data) {
                    setInitialData(json.data);
                }
                // Check initial validation status
                runValidation();
            } catch (e) {
                console.error("Failed to load application data:", e);
            }
            setLoading(false);
        }
        loadData();
    }, []);

    const runValidation = async () => {
        setValidating(true);
        try {
            const res = await fetch("/api/validate-profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({})
            });
            const json = await res.json();
            setValidationResult(json);
        } catch (e) {
            console.error("Validation error:", e);
        }
        setValidating(false);
    };

    const handleSave = async (data: ApplicationData) => {
        const res = await fetch("/api/application-data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            throw new Error("Failed to save");
        }
        // Run validation after saving
        await runValidation();
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

                {/* Validation Status Banner */}
                {validationResult && (
                    <div className={`mb-6 p-4 rounded-xl border-2 ${validationResult.status === 'validated'
                            ? 'bg-green-50 border-green-300'
                            : validationResult.status === 'mismatch'
                                ? 'bg-red-50 border-red-300'
                                : 'bg-yellow-50 border-yellow-300'
                        }`}>
                        <div className="flex items-start gap-3">
                            <div className="text-2xl">
                                {validationResult.status === 'validated' ? '✅' :
                                    validationResult.status === 'mismatch' ? '❌' : '⚠️'}
                            </div>
                            <div className="flex-1">
                                <h3 className={`font-bold ${validationResult.status === 'validated' ? 'text-green-800' :
                                        validationResult.status === 'mismatch' ? 'text-red-800' : 'text-yellow-800'
                                    }`}>
                                    {validationResult.status === 'validated' ? 'Podaci verifikovani!' :
                                        validationResult.status === 'mismatch' ? 'Pronađene nepodudarnosti' : 'Potrebna dodatna akcija'}
                                </h3>
                                <p className={`text-sm ${validationResult.status === 'validated' ? 'text-green-700' :
                                        validationResult.status === 'mismatch' ? 'text-red-700' : 'text-yellow-700'
                                    }`}>
                                    {validationResult.message}
                                </p>

                                {validationResult.issues && validationResult.issues.length > 0 && (
                                    <ul className="mt-3 space-y-2">
                                        {validationResult.issues.map((issue, idx) => (
                                            <li key={idx} className="text-sm text-red-700 bg-red-100 p-2 rounded">
                                                ⚠️ {issue.message}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                            {!validating && (
                                <button
                                    onClick={runValidation}
                                    className="text-sm text-blue-600 hover:underline"
                                >
                                    🔄 Ponovo proveri
                                </button>
                            )}
                        </div>
                    </div>
                )}

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
