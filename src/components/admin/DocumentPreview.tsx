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
            "EMPLOYER_CITY",
            "EMPLOYER_PIB",
            "EMPLOYER_MB",
            "EMPLOYER_DIRECTOR",
            "EMPLOYER_FOUNDING_DATE",
            "EMPLOYER_APR_NUMBER",
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
            "SALARY_RSD",
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
    {
        title: "Boravište / Accommodation",
        icon: "🏠",
        keys: ["ACCOMMODATION_ADDRESS", "SIGNING_CITY"],
    },
];

const LABELS: Record<string, string> = {
    WORKER_FULL_NAME: "Ime i prezime",
    WORKER_FIRST_NAME: "Ime",
    WORKER_LAST_NAME: "Prezime",
    WORKER_ADDRESS: "Adresa radnika",
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
    EMPLOYER_ADDRESS: "Adresa firme",
    EMPLOYER_CITY: "Grad (poštanski br.)",
    EMPLOYER_PIB: "PIB",
    EMPLOYER_MB: "Matični broj",
    EMPLOYER_DIRECTOR: "Direktor",
    EMPLOYER_FOUNDING_DATE: "Datum osnivanja",
    EMPLOYER_APR_NUMBER: "APR broj",
    JOB_TITLE_SR: "Naziv posla (SR)",
    JOB_TITLE_EN: "Job Title (EN)",
    JOB_DESC_SR_1: "Opis (SR) 1",
    JOB_DESC_SR_2: "Opis (SR) 2",
    JOB_DESC_SR_3: "Opis (SR) 3",
    JOB_DESC_EN_1: "Desc (EN) 1",
    JOB_DESC_EN_2: "Desc (EN) 2",
    JOB_DESC_EN_3: "Desc (EN) 3",
    SALARY_RSD: "Plata (RSD neto)",
    CONTRACT_START_DATE: "Početak ugovora",
    CONTRACT_END_DATE: "Kraj ugovora",
    SIGNING_DATE_SR: "Datum potpisivanja (SR)",
    SIGNING_DATE_EN: "Signing Date (EN)",
    CONTACT_EMAIL: "Email",
    CONTACT_PHONE: "Telefon",
    ACCOMMODATION_ADDRESS: "Adresa boravišta",
    SIGNING_CITY: "Grad potpisivanja",
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
        <div className="rounded-[28px] border border-[#e6e6e1] bg-white p-6 shadow-[0_18px_45px_-40px_rgba(15,23,42,0.3)]">
            <div className="mb-5">
                <div className="inline-flex rounded-full border border-[#e3ded2] bg-[#faf8f3] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b675d]">
                    Documents
                </div>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[#18181b]">Document payload preview</h2>
                <p className="mt-2 text-sm leading-relaxed text-[#57534e]">
                    Inspect the values that currently flow into the contract, statement, authorization, and invitation-letter templates.
                </p>
            </div>

            {error && (
                <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                    {error}
                </div>
            )}

            <button
                onClick={handleLoad}
                disabled={loading}
                className="w-full rounded-xl bg-[#18181b] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#27272a] disabled:opacity-50"
            >
                {loading ? (
                    <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Loading...
                    </span>
                ) : open ? (
                    "Hide payload preview"
                ) : (
                    "Load payload preview"
                )}
            </button>

            {open && data && (
                <div className="mt-4 space-y-4">
                    {!data.hasData ? (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                            {data.message || "No payload data is available for this worker yet."}
                        </div>
                    ) : (
                        <>
                            {data.generatedAt && (
                                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-700">
                                    Documents generated: {new Date(data.generatedAt).toLocaleString("en-GB")}
                                </div>
                            )}

                            {data.missingFields && data.missingFields.length > 0 && (
                                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                    <strong>Missing fields:</strong>
                                    <ul className="mt-1 list-disc list-inside text-xs">
                                        {data.missingFields.map((f) => (
                                            <li key={f}>{f}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {data.placeholders && SECTIONS.map((section) => (
                                <div
                                    key={section.title}
                                    className="overflow-hidden rounded-[22px] border border-[#ece8dd]"
                                >
                                    <div className="border-b border-[#ece8dd] bg-[#faf8f3] px-4 py-3">
                                        <h3 className="text-sm font-semibold text-[#18181b]">
                                            {section.icon} {section.title}
                                        </h3>
                                    </div>
                                    <div className="divide-y divide-[#f2eee6]">
                                        {section.keys.map((key) => {
                                            const value = data.placeholders![key] || "";
                                            const missing = isMissing(value);
                                            return (
                                                <div
                                                    key={key}
                                                    className={`flex items-start gap-3 px-4 py-3 text-sm ${missing ? "bg-red-50" : "bg-white"}`}
                                                >
                                                    <span className="min-w-[140px] shrink-0 pt-0.5 text-xs font-mono text-[#8a8479]">
                                                        {LABELS[key] || key}
                                                    </span>
                                                    <span
                                                        className={`flex-1 break-all ${missing
                                                            ? "italic text-red-500"
                                                            : "font-medium text-[#18181b]"
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
