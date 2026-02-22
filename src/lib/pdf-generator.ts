import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// Re-export styles registration (must be imported so fonts are registered)
import "./pdf-templates/styles";

// Import PDF template components
import UgovorORadu from "./pdf-templates/UgovorORadu";
import IzjavaOSaglasnosti from "./pdf-templates/IzjavaOSaglasnosti";
import Ovlascenje from "./pdf-templates/Ovlascenje";
import PozivnoPismo from "./pdf-templates/PozivnoPismo";

// ─── Types ───────────────────────────────────────────────────────────────────

export const DOCUMENT_TYPES = {
    UGOVOR: "UGOVOR",
    IZJAVA: "IZJAVA",
    OVLASCENJE: "OVLASCENJE",
    POZIVNO_PISMO: "POZIVNO_PISMO",
} as const;

export type DocumentType = keyof typeof DOCUMENT_TYPES;

export const DOCUMENT_LABELS: Record<DocumentType, string> = {
    UGOVOR: "UGOVOR O RADU",
    IZJAVA: "IZJAVA O SAGLASNOSTI",
    OVLASCENJE: "OVLAŠĆENJE",
    POZIVNO_PISMO: "POZIVNO PISMO",
};

export interface ContractDataForDocs {
    // Worker
    candidate_full_name: string;
    candidate_passport_number: string;
    candidate_nationality: string;
    candidate_date_of_birth: string;
    candidate_passport_expiry: string;
    candidate_address: string;
    candidate_passport_issue_date?: string | null;
    candidate_passport_issuer?: string | null;
    candidate_place_of_birth?: string | null;
    candidate_gender?: string | null;

    // Employer
    employer_company_name: string;
    employer_pib: string;
    employer_address: string;
    employer_representative_name: string;
    employer_mb?: string | null;
    employer_city?: string | null;
    employer_director?: string | null;
    employer_founding_date?: string | null;
    employer_apr_number?: string | null;

    // Job
    job_title: string;
    job_description_sr?: string | null;
    job_description_en?: string | null;
    salary_rsd: number;

    // Dates
    start_date: string;
    end_date?: string | null;
    signing_date?: string | null;

    // Contact
    contact_email?: string | null;
    contact_phone?: string | null;

    // Accommodation & signing
    accommodation_address?: string | null;
    signing_city?: string | null;
}

// ─── Nationality Mappings ────────────────────────────────────────────────────
// Maps nationality (as returned by Gemini from passport) to Serbian grammatical
// forms needed in contract templates.

interface NationalityForms {
    genitive: string;  // "državljanin [Nepala]" — used in UGOVOR, OVLAŠĆENJE
    locative: string;  // "u [Nepalu]" — used in IZJAVA
    english: string;   // "Nepalese" — used in English text
}

const NATIONALITY_MAP: Record<string, NationalityForms> = {
    // Key = normalized lowercase nationality from passport
    "nepalese": { genitive: "Nepala", locative: "Nepalu", english: "Nepalese" },
    "nepali": { genitive: "Nepala", locative: "Nepalu", english: "Nepalese" },
    "nepal": { genitive: "Nepala", locative: "Nepalu", english: "Nepalese" },
    "bangladeshi": { genitive: "Bangladeša", locative: "Bangladešu", english: "Bangladeshi" },
    "bangladesh": { genitive: "Bangladeša", locative: "Bangladešu", english: "Bangladeshi" },
    "indian": { genitive: "Indije", locative: "Indiji", english: "Indian" },
    "india": { genitive: "Indije", locative: "Indiji", english: "Indian" },
    "pakistani": { genitive: "Pakistana", locative: "Pakistanu", english: "Pakistani" },
    "pakistan": { genitive: "Pakistana", locative: "Pakistanu", english: "Pakistani" },
    "sri lankan": { genitive: "Šri Lanke", locative: "Šri Lanki", english: "Sri Lankan" },
    "filipino": { genitive: "Filipina", locative: "Filipinima", english: "Filipino" },
    "philippine": { genitive: "Filipina", locative: "Filipinima", english: "Filipino" },
    "indonesian": { genitive: "Indonezije", locative: "Indoneziji", english: "Indonesian" },
    "vietnamese": { genitive: "Vijetnama", locative: "Vijetnamu", english: "Vietnamese" },
    "uzbek": { genitive: "Uzbekistana", locative: "Uzbekistanu", english: "Uzbek" },
    "chinese": { genitive: "Kine", locative: "Kini", english: "Chinese" },
    "turkish": { genitive: "Turske", locative: "Turskoj", english: "Turkish" },
    "egyptian": { genitive: "Egipta", locative: "Egiptu", english: "Egyptian" },
    "tunisian": { genitive: "Tunisa", locative: "Tunisu", english: "Tunisian" },
    "moroccan": { genitive: "Maroka", locative: "Maroku", english: "Moroccan" },
    "albanian": { genitive: "Albanije", locative: "Albaniji", english: "Albanian" },
    "ukrainian": { genitive: "Ukrajine", locative: "Ukrajini", english: "Ukrainian" },
    "serbian": { genitive: "Srbije", locative: "Srbiji", english: "Serbian" },
};

// Default passport issuer per nationality (OCR often returns garbage)
const DEFAULT_ISSUERS: Record<string, string> = {
    "nepalese": "MOFA, DEPARTMENT OF PASSPORTS",
    "nepali": "MOFA, DEPARTMENT OF PASSPORTS",
    "nepal": "MOFA, DEPARTMENT OF PASSPORTS",
    "bangladeshi": "DIP, DHAKA",
    "bangladesh": "DIP, DHAKA",
};

// ─── Helper Functions ────────────────────────────────────────────────────────

function formatDateSR(dateStr: string | null | undefined): string {
    if (!dateStr) return "___________";
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const dd = String(d.getUTCDate()).padStart(2, "0");
        const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
        const yyyy = d.getUTCFullYear();
        return `${dd}.${mm}.${yyyy}.`;
    } catch {
        return dateStr;
    }
}

function formatDateEN(dateStr: string | null | undefined): string {
    if (!dateStr) return "___________";
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const months = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December",
        ];
        return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
    } catch {
        return dateStr;
    }
}

function getNationalityForms(nationality: string | null | undefined): NationalityForms {
    if (!nationality) return { genitive: "___________", locative: "___________", english: "___________" };
    const key = nationality.toLowerCase().trim();
    return NATIONALITY_MAP[key] || {
        genitive: nationality,
        locative: nationality,
        english: nationality,
    };
}

/**
 * Split full name into first and last name.
 * Convention: last word = last name, everything before = first name(s).
 */
function splitName(fullName: string): { firstName: string; lastName: string } {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) {
        return {
            firstName: parts.slice(0, -1).join(" "),
            lastName: parts[parts.length - 1],
        };
    }
    return { firstName: fullName, lastName: fullName };
}

/**
 * Split job description into exactly 3 lines.
 * If fewer than 3, remaining are empty. If more than 3, extras appended to line 3.
 */
function splitJobDescription(text: string | null | undefined): [string, string, string] {
    if (!text) return ["", "", ""];
    const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return ["", "", ""];
    if (lines.length === 1) return [lines[0], "", ""];
    if (lines.length === 2) return [lines[0], lines[1], ""];
    if (lines.length === 3) return [lines[0], lines[1], lines[2]];
    return [lines[0], lines[1], lines.slice(2).join(" ")];
}

/**
 * Get passport issuer — uses known default for nationality if AI extraction is empty/garbage.
 */
function getPassportIssuer(
    issuer: string | null | undefined,
    nationality: string | null | undefined,
): string {
    if (issuer && issuer.trim().length > 3) return issuer;
    if (!nationality) return "___________";
    const key = nationality.toLowerCase().trim();
    return DEFAULT_ISSUERS[key] || issuer || "___________";
}

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * Build the placeholder→value map from contract_data.
 * Keys match the placeholder variables used in all 4 PDF templates.
 */
export function buildPlaceholderData(data: ContractDataForDocs): Record<string, string> {
    const natForms = getNationalityForms(data.candidate_nationality);
    const { firstName, lastName } = splitName(data.candidate_full_name || "");
    const [descSr1, descSr2, descSr3] = splitJobDescription(data.job_description_sr);
    const [descEn1, descEn2, descEn3] = splitJobDescription(data.job_description_en);

    return {
        // Worker personal data
        WORKER_FULL_NAME: data.candidate_full_name || "___________",
        WORKER_FIRST_NAME: firstName,
        WORKER_LAST_NAME: lastName,
        WORKER_ADDRESS: data.candidate_address || "___________",

        // Passport data
        PASSPORT_NUMBER: data.candidate_passport_number || "___________",
        DATE_OF_BIRTH: formatDateSR(data.candidate_date_of_birth),
        PLACE_OF_BIRTH: data.candidate_place_of_birth || "___________",
        PASSPORT_ISSUE_DATE: formatDateSR(data.candidate_passport_issue_date),
        PASSPORT_EXPIRY_DATE: formatDateSR(data.candidate_passport_expiry),
        PASSPORT_ISSUER: getPassportIssuer(
            data.candidate_passport_issuer,
            data.candidate_nationality,
        ),

        // Nationality — 3 forms for Serbian grammar + English
        NATIONALITY_SR_GENITIVE: natForms.genitive,  // "državljanin [Nepala]"
        NATIONALITY_SR_LOCATIVE: natForms.locative,   // "u [Nepalu]"
        NATIONALITY_EN: natForms.english,              // "Nepalese"

        // Employer data
        EMPLOYER_NAME: data.employer_company_name || "___________",
        EMPLOYER_FULL_REFERENCE: [
            data.employer_company_name,
            data.employer_address,
            data.employer_city,
        ].filter(Boolean).join(", "),
        EMPLOYER_ADDRESS: data.employer_address || "___________",
        EMPLOYER_CITY: data.employer_city || "___________",
        EMPLOYER_PIB: data.employer_pib || "___________",
        EMPLOYER_MB: data.employer_mb || "___________",
        EMPLOYER_DIRECTOR: data.employer_director || data.employer_representative_name || "___________",
        EMPLOYER_FOUNDING_DATE: data.employer_founding_date || "___________",
        EMPLOYER_APR_NUMBER: data.employer_apr_number || "___________",

        // Job data
        JOB_TITLE_SR: data.job_title || "___________",
        JOB_TITLE_EN: data.job_title || "___________",
        JOB_DESC_SR_1: descSr1,
        JOB_DESC_SR_2: descSr2,
        JOB_DESC_SR_3: descSr3,
        JOB_DESC_EN_1: descEn1,
        JOB_DESC_EN_2: descEn2,
        JOB_DESC_EN_3: descEn3,
        SALARY_RSD: data.salary_rsd
            ? new Intl.NumberFormat("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(data.salary_rsd)
            : "___________",

        // Dates
        CONTRACT_START_DATE: formatDateSR(data.start_date),
        CONTRACT_END_DATE: formatDateSR(data.end_date),
        SIGNING_DATE_SR: formatDateSR(data.signing_date),
        SIGNING_DATE_EN: formatDateEN(data.signing_date),

        // Contact
        CONTACT_EMAIL: data.contact_email || "contact@workersunited.eu",
        CONTACT_PHONE: data.contact_phone || "",

        // Accommodation & signing location
        ACCOMMODATION_ADDRESS: data.accommodation_address || "___________",
        SIGNING_CITY: data.signing_city || "___________",
    };
}

// ─── PDF Template Map ────────────────────────────────────────────────────────

const TEMPLATE_COMPONENTS: Record<DocumentType, React.FC<{ data: Record<string, string> }>> = {
    UGOVOR: UgovorORadu,
    IZJAVA: IzjavaOSaglasnosti,
    OVLASCENJE: Ovlascenje,
    POZIVNO_PISMO: PozivnoPismo,
};

/**
 * Stamp bilingual page numbers on every page of a PDF using pdf-lib.
 * Uses Helvetica (built-in) since page number text is ASCII-only.
 * Format: "Strana 1 od 3 / Page 1 of 3"
 */
async function stampPageNumbers(pdfBytes: Uint8Array): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();
    const totalPages = pages.length;
    const fontSize = 7.5;
    const color = rgb(0.5, 0.5, 0.5); // gray

    for (let i = 0; i < totalPages; i++) {
        const page = pages[i];
        const { width } = page.getSize();
        const text = `Strana ${i + 1} od ${totalPages} / Page ${i + 1} of ${totalPages}`;
        const textWidth = font.widthOfTextAtSize(text, fontSize);

        page.drawText(text, {
            x: (width - textWidth) / 2,
            y: 18,
            size: fontSize,
            font,
            color,
        });
    }

    const resultBytes = await pdfDoc.save();
    return Buffer.from(resultBytes);
}

/**
 * Generate a single PDF document.
 * Returns a Buffer containing the generated PDF file.
 */
export async function generateDocument(
    docType: DocumentType,
    contractData: ContractDataForDocs
): Promise<Buffer> {
    const Component = TEMPLATE_COMPONENTS[docType];
    if (!Component) {
        throw new Error(`Unknown document type: ${docType}`);
    }

    const placeholderData = buildPlaceholderData(contractData);
    const element = React.createElement(Component, { data: placeholderData });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(element as any);

    let pdfBuffer = Buffer.from(buffer);

    // Stamp page numbers on UGOVOR (the only multi-page document)
    if (docType === "UGOVOR") {
        pdfBuffer = Buffer.from(await stampPageNumbers(pdfBuffer));
    }

    return pdfBuffer;
}

/**
 * Generate all 4 documents for a contract.
 * Returns a map of document type → Buffer.
 */
export async function generateAllDocuments(
    contractData: ContractDataForDocs
): Promise<Map<DocumentType, Buffer>> {
    const results = new Map<DocumentType, Buffer>();

    for (const docType of Object.keys(DOCUMENT_TYPES) as DocumentType[]) {
        try {
            const buffer = await generateDocument(docType, contractData);
            results.set(docType, buffer);
        } catch (error) {
            console.error(`Failed to generate ${docType}:`, error);
            throw new Error(`Failed to generate ${docType}: ${error}`);
        }
    }

    return results;
}

/**
 * Validate that contract_data has all required fields for document generation.
 * Returns a list of missing field names (empty = all good).
 */
export function validateContractData(data: ContractDataForDocs): string[] {
    const missing: string[] = [];

    if (!data.candidate_full_name) missing.push("Worker full name");
    if (!data.candidate_passport_number) missing.push("Passport number");
    if (!data.candidate_nationality) missing.push("Nationality");
    if (!data.candidate_date_of_birth) missing.push("Date of birth");
    if (!data.candidate_passport_expiry) missing.push("Passport expiry date");
    if (!data.employer_company_name) missing.push("Employer company name");
    if (!data.employer_address) missing.push("Employer address");
    if (!data.employer_pib) missing.push("Employer PIB");
    if (!data.employer_city) missing.push("Employer city");
    if (!data.employer_mb) missing.push("Employer MB (matični broj)");
    if (!data.employer_director) missing.push("Employer director");
    if (!data.signing_city) missing.push("Signing city");
    if (!data.accommodation_address) missing.push("Accommodation address");
    if (!data.job_title) missing.push("Job title");
    if (!data.salary_rsd) missing.push("Salary (RSD)");
    if (!data.start_date) missing.push("Contract start date");
    if (!data.end_date) missing.push("Contract end date");
    if (!data.signing_date) missing.push("Signing date");

    return missing;
}
