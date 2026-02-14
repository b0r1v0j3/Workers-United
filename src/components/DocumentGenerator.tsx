"use client";

import { useState, useEffect } from "react";

interface DocumentGeneratorProps {
    candidateId: string;
    matchId?: string;
    candidateName: string;
}

interface GeneratedDocs {
    [key: string]: string;
}

const DOC_LABELS: Record<string, string> = {
    UGOVOR: "📄 UGOVOR O RADU",
    IZJAVA: "📋 IZJAVA O SAGLASNOSTI",
    OVLASCENJE: "📝 OVLAŠĆENJE",
    POZIVNO_PISMO: "✉️ POZIVNO PISMO",
};

export default function DocumentGenerator({ candidateId, matchId, candidateName }: DocumentGeneratorProps) {
    const [status, setStatus] = useState<"idle" | "preparing" | "generating" | "done" | "error">("idle");
    const [message, setMessage] = useState("");
    const [documents, setDocuments] = useState<GeneratedDocs>({});
    const [currentMatchId, setCurrentMatchId] = useState(matchId || "");
    const [missingFields, setMissingFields] = useState<string[]>([]);

    // Step 1: Prepare contract data (if not already done)
    async function handlePrepare() {
        if (!currentMatchId) {
            setMessage("⚠️ No match ID available. Worker must be matched first.");
            setStatus("error");
            return;
        }

        setStatus("preparing");
        setMessage("Preparing contract data...");

        try {
            const res = await fetch("/api/contracts/prepare", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ matchId: currentMatchId }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to prepare contract data");
            }

            setMessage("✅ Contract data prepared successfully!");
            setStatus("idle");
        } catch (err) {
            setMessage(`❌ ${err instanceof Error ? err.message : "Preparation failed"}`);
            setStatus("error");
        }
    }

    // Step 2: Generate DOCX documents
    async function handleGenerate() {
        if (!currentMatchId) {
            setMessage("⚠️ No match ID available.");
            setStatus("error");
            return;
        }

        setStatus("generating");
        setMessage("⏳ Generating documents...");
        setMissingFields([]);

        try {
            const res = await fetch("/api/contracts/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ matchId: currentMatchId }),
            });

            const data = await res.json();
            if (!res.ok) {
                if (data.missingFields) {
                    setMissingFields(data.missingFields);
                }
                throw new Error(data.error || "Generation failed");
            }

            setDocuments(data.documents || {});
            setMessage(`✅ ${Object.keys(data.documents || {}).length} documents generated!`);
            setStatus("done");
        } catch (err) {
            setMessage(`❌ ${err instanceof Error ? err.message : "Generation failed"}`);
            setStatus("error");
        }
    }

    // Check for existing generated documents
    async function handleCheckStatus() {
        if (!currentMatchId) return;

        try {
            const res = await fetch(`/api/contracts/generate?matchId=${currentMatchId}`);
            const data = await res.json();

            if (data.generated && data.documents) {
                setDocuments(data.documents);
                setMessage(`Previously generated on ${new Date(data.generatedAt).toLocaleString("en-GB")}`);
                setStatus("done");
            }
        } catch {
            // Silently fail — documents may not exist yet
        }
    }

    // Load existing docs on mount
    useEffect(() => {
        if (currentMatchId) {
            handleCheckStatus();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="bg-white rounded-[16px] shadow-sm border border-[#dde3ec] p-6">
            <h2 className="font-bold text-[#1e293b] text-xl mb-2">📄 Visa Documents</h2>
            <p className="text-[#64748b] text-sm mb-4">
                Generate UGOVOR, IZJAVA, OVLAŠĆENJE, POZIVNO PISMO for {candidateName}
            </p>

            {/* Match ID input (if not provided) */}
            {!matchId && (
                <div className="mb-4">
                    <label className="text-[12px] text-[#64748b] uppercase font-bold block mb-2">
                        Match ID
                    </label>
                    <input
                        type="text"
                        value={currentMatchId}
                        onChange={(e) => setCurrentMatchId(e.target.value)}
                        placeholder="Enter match UUID..."
                        className="w-full border border-[#dde3ec] rounded-lg px-3 py-2 text-sm"
                    />
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 mb-4">
                <button
                    onClick={handlePrepare}
                    disabled={status === "preparing" || status === "generating" || !currentMatchId}
                    className="bg-[#2f6fed] text-white px-4 py-2.5 rounded-lg font-bold text-sm hover:bg-[#1e5cd6] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {status === "preparing" ? "⏳ Preparing..." : "1. Prepare Data"}
                </button>

                <button
                    onClick={handleGenerate}
                    disabled={status === "preparing" || status === "generating" || !currentMatchId}
                    className="bg-[#059669] text-white px-4 py-2.5 rounded-lg font-bold text-sm hover:bg-[#047857] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {status === "generating" ? "⏳ Generating..." : "2. Generate Documents"}
                </button>
            </div>

            {/* Status Message */}
            {message && (
                <div className={`rounded-lg p-3 text-sm mb-4 ${status === "error"
                    ? "bg-red-50 text-red-700 border border-red-200"
                    : status === "done"
                        ? "bg-green-50 text-green-700 border border-green-200"
                        : "bg-blue-50 text-blue-700 border border-blue-200"
                    }`}>
                    {message}
                    {missingFields.length > 0 && (
                        <ul className="mt-2 list-disc list-inside text-xs">
                            {missingFields.map((field) => (
                                <li key={field}>{field}</li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {/* Generated Documents List */}
            {Object.keys(documents).length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-sm font-bold text-[#1e293b] uppercase mb-2">Generated Documents:</h3>
                    {Object.entries(documents).map(([docType, url]) => (
                        <a
                            key={docType}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-3 rounded-lg border border-[#dde3ec] hover:bg-[#f8fafc] hover:border-[#2f6fed] transition-all group"
                        >
                            <span className="text-lg">{DOC_LABELS[docType]?.split(" ")[0] || "📄"}</span>
                            <div className="flex-1">
                                <div className="font-medium text-[#1e293b] group-hover:text-[#2f6fed]">
                                    {DOC_LABELS[docType] || docType}
                                </div>
                                <div className="text-[11px] text-[#94a3b8]">DOCX • Click to download</div>
                            </div>
                            <span className="text-[#2f6fed] font-bold text-sm">↓</span>
                        </a>
                    ))}
                </div>
            )}

            {/* No match available */}
            {!currentMatchId && (
                <div className="text-[#94a3b8] italic text-sm">
                    Worker must be matched with an employer first before generating documents.
                </div>
            )}
        </div>
    );
}
