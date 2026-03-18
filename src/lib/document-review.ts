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
    const issues = readStringArray(ai.issues).map((issue) => issue.toLowerCase());
    const documentKind = readString(ai.document_kind)?.toLowerCase();

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
        const documentKind = readString(ai.document_kind)?.toLowerCase();
        const institution = readString(ai.institution_name);
        const degreeType = readString(ai.degree_type);

        if (documentKind === "short_course_certificate" || documentKind === "attendance_or_participation_certificate") {
            return institution
                ? `Short course certificate detected from ${institution}`
                : "Short course certificate detected";
        }

        if (documentKind === "transcript_or_marksheet") {
            return "Transcript or marksheet detected";
        }

        const pieces = [
            institution ? `Diploma detected from ${institution}` : null,
            degreeType,
        ].filter(Boolean);

        if (pieces.length > 0) {
            return pieces.join(" • ");
        }
    }

    if (documentType === "biometric_photo") {
        if (documentKind === "printed_photo_scan" || issues.includes("scan_of_printed_photo")) {
            return "Printed portrait scan detected";
        }

        if (issues.some((issue) => [
            "blurry",
            "low_resolution",
            "pixelated",
            "dark",
            "shadow_on_face",
            "glare",
            "background_not_plain",
            "background_too_busy",
            "face_not_centered",
            "face_too_small",
            "head_cropped",
            "tilted_head",
            "eyes_not_visible",
            "filtered_image",
        ].includes(issue))) {
            const confidence = typeof ai.confidence === "number"
                ? `${Math.round(ai.confidence * 100)}% confidence`
                : null;
            return confidence
                ? `Biometric photo detected, but quality is too weak for embassy use • ${confidence}`
                : "Biometric photo detected, but quality is too weak for embassy use";
        }

        const confidence = typeof ai.confidence === "number"
            ? `${Math.round(ai.confidence * 100)}% confidence`
            : null;
        return confidence ? `Biometric photo detected • ${confidence}` : "Biometric photo detected";
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
        if (documentKind === "printed_photo_scan" || issues.includes("scan_of_printed_photo")) {
            return "Please upload the original digital biometric photo or take a new passport-style photo. Do not upload a scan or a photo of an older printed portrait.";
        }

        if (issues.includes("multiple_people")) {
            return "Please upload a recent passport-style photo of only yourself. No other people can appear in the image.";
        }

        if (issues.includes("no_face_detected")) {
            return "Please upload a recent passport-style photo of only yourself with your full face clearly visible and facing forward.";
        }

        const guidanceParts: string[] = [];

        if (issues.some((issue) => ["blurry", "low_resolution", "pixelated"].includes(issue))) {
            guidanceParts.push("a sharper, higher-resolution image");
        }

        if (issues.some((issue) => ["dark", "shadow_on_face", "glare"].includes(issue))) {
            guidanceParts.push("bright, even lighting with no heavy shadows or glare");
        }

        if (issues.some((issue) => ["background_not_plain", "background_too_busy"].includes(issue))) {
            guidanceParts.push("a plain light background with no distracting objects");
        }

        if (issues.some((issue) => ["face_not_centered", "face_too_small", "head_cropped", "tilted_head", "eyes_not_visible"].includes(issue))) {
            guidanceParts.push("a centered, front-facing pose with your head and upper shoulders fully visible");
        }

        if (issues.includes("filtered_image")) {
            guidanceParts.push("no beauty filters or heavy retouching");
        }

        if (guidanceParts.length > 0) {
            return `Please upload a recent passport-style biometric photo of only yourself with ${guidanceParts.join(", ")}.`;
        }

        return "Please upload a recent passport-style biometric photo of only yourself with a plain light background, centered face, sharp quality, and even lighting.";
    }

    if (documentType === "diploma") {
        if (documentKind === "short_course_certificate" || documentKind === "attendance_or_participation_certificate" || issues.includes("short_course_not_accepted")) {
            return "Please upload your final school, university, or formal vocational diploma. Short course, workshop, attendance, and certificate of completion files cannot be accepted.";
        }

        if (documentKind === "transcript_or_marksheet" || issues.includes("transcript_only")) {
            return "Please upload your final diploma or degree certificate, not only a transcript or marksheet.";
        }

        if (issues.some((issue) => ["blurry", "cropped", "unreadable_fields", "missing_title"].includes(issue))) {
            return "Please upload a clearer image or scan of your final school, university, or formal vocational diploma. The document title, institution name, your name, and the main text must all be visible.";
        }

        return "Please upload your final school, university, or formal vocational diploma. The document title, institution name, your name, and the main text must all be visible.";
    }

    return `Please upload a clearer ${humanizeDocumentType(documentType).toLowerCase()} file.`;
}
