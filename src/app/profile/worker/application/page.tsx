"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ApplicationDataForm from "@/components/ApplicationDataForm";
import { ApplicationData } from "@/types/application";
import {
    AlertTriangle,
    CheckCircle,
    ChevronLeft,
    RefreshCw,
    ShieldAlert,
    ShieldCheck,
    ShieldQuestion
} from "lucide-react";

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
        <div className="min-h-screen bg-slate-50 font-sans pb-20">
            {/* Header / Nav */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="max-w-5xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
                    <Link
                        href="/profile/worker"
                        className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors font-medium"
                    >
                        <ChevronLeft size={20} />
                        Nazad na Dashboard
                    </Link>
                    <div className="flex items-center gap-4">
                        <div className="h-4 w-px bg-slate-200" />
                        <span className="text-sm font-semibold text-slate-400">e-Uprava Aplikacija</span>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 md:px-8 py-10">
                <div className="mb-10 text-center">
                    <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4 tracking-tight">
                        Podaci za Aplikaciju
                    </h1>
                    <p className="text-slate-500 max-w-2xl mx-auto text-lg leading-relaxed">
                        Popunite i proverite vaše podatke pre slanja. Ovi podaci će biti korišćeni za generisanje zvaničnih dokumenata za radnu dozvolu.
                    </p>
                </div>

                {/* Validation Status Banner */}
                {validationResult && (
                    <div className={`mb-10 rounded-2xl border-2 overflow-hidden transition-all ${validationResult.status === 'validated'
                        ? 'bg-green-50 border-green-100'
                        : validationResult.status === 'mismatch'
                            ? 'bg-red-50 border-red-100'
                            : 'bg-amber-50 border-amber-100'
                        }`}>
                        <div className="p-6 md:p-8">
                            <div className="flex items-start gap-6">
                                <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${validationResult.status === 'validated' ? 'bg-green-100 text-green-600' :
                                    validationResult.status === 'mismatch' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                                    }`}>
                                    {validationResult.status === 'validated' ? <ShieldCheck size={28} /> :
                                        validationResult.status === 'mismatch' ? <ShieldAlert size={28} /> : <ShieldQuestion size={28} />}
                                </div>

                                <div className="flex-1">
                                    <div className="flex items-center justify-between gap-4 mb-2">
                                        <h3 className={`text-xl font-bold ${validationResult.status === 'validated' ? 'text-green-900' :
                                            validationResult.status === 'mismatch' ? 'text-red-900' : 'text-amber-900'
                                            }`}>
                                            {validationResult.status === 'validated' ? 'Podaci su verifikovani' :
                                                validationResult.status === 'mismatch' ? 'Pronađene nepodudarnosti' : 'Potrebna provera'}
                                        </h3>

                                        {!validating ? (
                                            <button
                                                onClick={runValidation}
                                                className="flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
                                            >
                                                <RefreshCw size={14} />
                                                Proveri ponovo
                                            </button>
                                        ) : (
                                            <span className="text-sm text-slate-400 font-medium px-3 py-1.5 flex items-center gap-2">
                                                <RefreshCw size={14} className="animate-spin" /> Provera...
                                            </span>
                                        )}
                                    </div>

                                    <p className={`text-base leading-relaxed ${validationResult.status === 'validated' ? 'text-green-700' :
                                        validationResult.status === 'mismatch' ? 'text-red-700' : 'text-amber-700'
                                        }`}>
                                        {validationResult.message}
                                    </p>

                                    {validationResult.issues && validationResult.issues.length > 0 && (
                                        <div className="mt-6 space-y-3">
                                            {validationResult.issues.map((issue, idx) => (
                                                <div key={idx} className="flex items-start gap-3 p-4 bg-white/60 rounded-xl border border-red-100/50">
                                                    <AlertTriangle size={18} className="text-red-500 mt-0.5 flex-shrink-0" />
                                                    <span className="text-red-700 text-sm font-medium">{issue.message}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Footer Strip */}
                        {validationResult.status === 'validated' && (
                            <div className="bg-green-100/50 px-8 py-3 flex items-center gap-2 text-sm font-medium text-green-800 border-t border-green-100">
                                <CheckCircle size={16} />
                                Spremni ste za podnošenje zahteva
                            </div>
                        )}
                    </div>
                )}

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-32 text-slate-400">
                        <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin mb-4" />
                        <p className="font-medium">Učitavanje podataka...</p>
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

