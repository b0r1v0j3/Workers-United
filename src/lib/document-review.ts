type JsonRecord = Record<string, unknown>;

export function asJsonRecord(value: unknown): JsonRecord | null {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value as JsonRecord
        : null;
}

function readString(value: unknown): string | null {
    return typeof value === "string" && value.trim().length > 0
        ? value.trim()
        : null;
}

function readStringArray(value: unknown): string[] {
    return Array.isArray(value)
        ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        : [];
}

export function humanizeDocumentType(documentType: string): string {
    return documentType
        .toLowerCase()
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

export function buildDocumentAiSummary(documentType: string, ocrJson: unknown, rejectReason?: string | null): string | null {
    if (rejectReason?.trim()) {
        return rejectReason.trim();
    }

    const ai = asJsonRecord(ocrJson);
    if (!ai) {
        return null;
    }

    const summary = readString(ai.summary)
        || readString(ai.document_summary)
        || readString(ai.document_description);

    if (summary) {
        return summary;
    }

    if (documentType === "passport") {
        const fullName = readString(ai.full_name);
        const passportNumber = readString(ai.passport_number);
        const expiryDate = readString(ai.expiry_date);
        const pieces = [
            fullName ? `Passport page detected for ${fullName}` : null,
            passportNumber ? `No. ${passportNumber}` : null,
            expiryDate ? `expires ${expiryDate}` : null,
        ].filter(Boolean);

        if (pieces.length > 0) {
            return pieces.join(" • ");
        }
    }

    if (documentType === "diploma") {
        const institution = readString(ai.institution_name);
        const degreeType = readString(ai.degree_type);
        const pieces = [
            institution ? `Diploma detected from ${institution}` : null,
            degreeType,
        ].filter(Boolean);

        if (pieces.length > 0) {
            return pieces.join(" • ");
        }
    }

    if (documentType === "biometric_photo") {
        const confidence = typeof ai.confidence === "number"
            ? `${Math.round(ai.confidence * 100)}% confidence`
            : null;
        return confidence ? `Face photo detected • ${confidence}` : "Face photo detected";
    }

    return null;
}

export function buildDocumentRequestReason(documentType: string, ocrJson: unknown, rejectReason?: string | null): string {
    if (rejectReason?.trim()) {
        return rejectReason.trim();
    }

    const ai = asJsonRecord(ocrJson);
    const issues = readStringArray(ai?.issues).map((issue) => issue.toLowerCase());
    const workerGuidance = readString(ai?.worker_guidance);
    const documentKind = readString(ai?.document_kind)?.toLowerCase();

    if (workerGuidance) {
        return workerGuidance;
    }

    if (documentType === "passport") {
        if (documentKind === "passport_cover" || issues.includes("passport_cover_only")) {
            return "Please upload the inside passport identity page, not the closed passport cover. Your photo, full name, passport number, and expiry date must all be clearly visible in one image.";
        }

        if (documentKind === "passport_other_page" || issues.includes("passport_other_page")) {
            return "Please upload the passport identity page with your photo and personal details. Visa pages, stamp pages, and other inside pages cannot be accepted.";
        }

        if (issues.some((issue) => ["blurry", "glare", "cropped", "unreadable_fields"].includes(issue))) {
            return "Please upload a clearer passport identity page. Place the page flat, avoid glare, and make sure the full page is visible and readable.";
        }

        return "Please upload a clear photo or scan of your passport identity page. The page with your photo, full name, passport number, and expiry date must be visible.";
    }

    if (documentType === "biometric_photo") {
        return "Please upload a clear photo of yourself only. Your face should be visible, centered, and taken in good lighting.";
    }

    if (documentType === "diploma") {
        return "Please upload your diploma or education certificate again. The document title, institution name, and main text should be visible and readable.";
    }

    return `Please upload a clearer ${humanizeDocumentType(documentType).toLowerCase()} file.`;
}
