"use client";

import { useState } from "react";

interface PreviewData {
    hasData: boolean;
    matchId?: string;
    generatedAt?: string;
    placeholders?: Record<string, string>;
    missingFields?: string[];
    message?: string;
}

const SECTIONS: { title: string; icon: string; keys: string[] }[] = [
    {
        title: "Radnik / Worker",
        icon: "👤",
        keys: [
            "WORKER_FULL_NAME",
            "WORKER_FIRST_NAME",
            "WORKER_LAST_NAME",
            "WORKER_ADDRESS",
        ],
    },
    {
        title: "Pasoš / Passport",
        icon: "🛂",
        keys: [
            "PASSPORT_NUMBER",
            "DATE_OF_BIRTH",
            "PLACE_OF_BIRTH",
            "PASSPORT_ISSUE_DATE",
            "PASSPORT_EXPIRY_DATE",
            "PASSPORT_ISSUER",
        ],
    },
    {
        title: "Nacionalnost / Nationality",
        icon: "🌍",
        keys: [
            "NATIONALITY_SR_GENITIVE",
            "NATIONALITY_SR_LOCATIVE",
            "NATIONALITY_EN",
        ],
    },
    {
        title: "Poslodavac / Employer",
        icon: "🏢",
        keys: [
            "EMPLOYER_NAME",
            "EMPLOYER_FULL_REFERENCE",
            "EMPLOYER_ADDRESS",
            "EMPLOYER_MB",
            "EMPLOYER_DIRECTOR",
        ],
    },
    {
        title: "Posao / Job",
        icon: "💼",
        keys: [
            "JOB_TITLE_SR",
            "JOB_TITLE_EN",
            "JOB_DESC_SR_1",
            "JOB_DESC_SR_2",
            "JOB_DESC_SR_3",
            "JOB_DESC_EN_1",
            "JOB_DESC_EN_2",
            "JOB_DESC_EN_3",
        ],
    },
    {
        title: "Datumi / Dates",
        icon: "📅",
        keys: [
            "CONTRACT_START_DATE",
            "CONTRACT_END_DATE",
            "SIGNING_DATE_SR",
            "SIGNING_DATE_EN",
        ],
    },
    {
        title: "Kontakt / Contact",
        icon: "📧",
        keys: ["CONTACT_EMAIL", "CONTACT_PHONE"],
    },
];

// Human-readable labels for placeholder keys
const LABELS: Record<string, string> = {
    WORKER_FULL_NAME: "Ime i prezime",
    WORKER_FIRST_NAME: "Ime",
    WORKER_LAST_NAME: "Prezime",
    WORKER_ADDRESS: "Adresa",
    PASSPORT_NUMBER: "Broj pasoša",
    DATE_OF_BIRTH: "Datum rođenja",
    PLACE_OF_BIRTH: "Mesto rođenja",
    PASSPORT_ISSUE_DATE: "Datum izdavanja",
    PASSPORT_EXPIRY_DATE: "Datum isteka",
    PASSPORT_ISSUER: "Izdao",
    NATIONALITY_SR_GENITIVE: "Genitiv (SR)",
    NATIONALITY_SR_LOCATIVE: "Lokativ (SR)",
    NATIONALITY_EN: "English",
    EMPLOYER_NAME: "Naziv firme",
    EMPLOYER_FULL_REFERENCE: "Puna referenca",
    EMPLOYER_ADDRESS: "Adresa",
    EMPLOYER_MB: "Matični broj",
    EMPLOYER_DIRECTOR: "Direktor",
    JOB_TITLE_SR: "Naziv posla (SR)",
    JOB_TITLE_EN: "Job Title (EN)",
    JOB_DESC_SR_1: "Opis (SR) 1",
    JOB_DESC_SR_2: "Opis (SR) 2",
    JOB_DESC_SR_3: "Opis (SR) 3",
    JOB_DESC_EN_1: "Desc (EN) 1",
    JOB_DESC_EN_2: "Desc (EN) 2",
    JOB_DESC_EN_3: "Desc (EN) 3",
    CONTRACT_START_DATE: "Početak ugovora",
    CONTRACT_END_DATE: "Kraj ugovora",
    SIGNING_DATE_SR: "Datum potpisivanja (SR)",
    SIGNING_DATE_EN: "Signing Date (EN)",
    CONTACT_EMAIL: "Email",
    CONTACT_PHONE: "Telefon",
};

export default function DocumentPreview({ profileId }: { profileId: string }) {
    const [data, setData] = useState<PreviewData | null>(null);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleLoad() {
        if (open && data) {
            setOpen(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`/api/contracts/preview?profileId=${profileId}`);
            const json = await res.json();

            if (!res.ok) {
                throw new Error(json.error || "Failed to load preview");
            }

            setData(json);
            setOpen(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load");
        } finally {
            setLoading(false);
        }
    }

    const isMissing = (value: string) =>
        !value || value === "___________" || value.trim() === "";

    return (
        <div className="bg-white rounded-[16px] shadow-sm border border-[#dde3ec] p-6">
            <h2 className="font-bold text-[#1e293b] text-xl mb-2">👁️ Pregled Dokumenata</h2>
            <p className="text-[#64748b] text-sm mb-4">
                Pogledaj koje vrednosti idu u UGOVOR, IZJAVU, OVLAŠĆENJE, POZIVNO PISMO
            </p>

            {error && (
                <div className="mb-3 px-3 py-2 rounded-lg text-sm font-medium bg-red-50 text-red-700 border border-red-200">
                    {error}
                </div>
            )}

            <button
                onClick={handleLoad}
                disabled={loading}
                className="w-full bg-gradient-to-r from-violet-500 to-violet-600 text-white py-2.5 rounded-lg font-bold text-sm hover:from-violet-600 hover:to-violet-700 disabled:opacity-50 transition-all"
            >
                {loading ? (
                    <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Učitavanje...
                    </span>
                ) : open ? (
                    "🔽 Zatvori pregled"
                ) : (
                    "👁️ Prikaži pregled dokumenata"
                )}
            </button>

            {/* Preview Content */}
            {open && data && (
                <div className="mt-4 space-y-4">
                    {!data.hasData ? (
                        <div className="px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                            ⚠️ {data.message || "Nema podataka za ovog radnika."}
                        </div>
                    ) : (
                        <>
                            {/* Generated status */}
                            {data.generatedAt && (
                                <div className="px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-green-700 text-xs font-medium">
                                    ✅ Dokumenta generisana: {new Date(data.generatedAt).toLocaleString("sr-RS")}
                                </div>
                            )}

                            {/* Missing fields warning */}
                            {data.missingFields && data.missingFields.length > 0 && (
                                <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                                    <strong>⚠️ Nedostaju polja:</strong>
                                    <ul className="mt-1 list-disc list-inside text-xs">
                                        {data.missingFields.map((f) => (
                                            <li key={f}>{f}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Placeholder sections */}
                            {data.placeholders && SECTIONS.map((section) => (
                                <div
                                    key={section.title}
                                    className="border border-[#e2e8f0] rounded-xl overflow-hidden"
                                >
                                    <div className="bg-[#f8fafc] px-4 py-2.5 border-b border-[#e2e8f0]">
                                        <h3 className="font-bold text-[#334155] text-sm">
                                            {section.icon} {section.title}
                                        </h3>
                                    </div>
                                    <div className="divide-y divide-[#f1f5f9]">
                                        {section.keys.map((key) => {
                                            const value = data.placeholders![key] || "";
                                            const missing = isMissing(value);
                                            return (
                                                <div
                                                    key={key}
                                                    className={`flex items-start gap-3 px-4 py-2 text-sm ${missing ? "bg-red-50" : ""
                                                        }`}
                                                >
                                                    <span className="text-[#64748b] text-xs font-mono min-w-[130px] pt-0.5 shrink-0">
                                                        {LABELS[key] || key}
                                                    </span>
                                                    <span
                                                        className={`flex-1 break-all ${missing
                                                            ? "text-red-400 italic"
                                                            : "text-[#1e293b] font-medium"
                                                            }`}
                                                    >
                                                        {value || "—"}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
