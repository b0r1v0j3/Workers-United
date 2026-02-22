// Quick script to generate sample PDFs for preview
// Run: npx tsx scripts/generate-sample-pdfs.ts

import { generateAllDocuments, type ContractDataForDocs } from "../src/lib/pdf-generator";
import { writeFileSync, mkdirSync } from "fs";
import path from "path";

const sampleData: ContractDataForDocs = {
    candidate_full_name: "Ram Bahadur Tamang",
    candidate_passport_number: "PA1234567",
    candidate_nationality: "Nepalese",
    candidate_date_of_birth: "1990-05-15",
    candidate_passport_expiry: "2030-05-15",
    candidate_address: "Kathmandu, Nepal",
    candidate_passport_issue_date: "2020-05-15",
    candidate_passport_issuer: "MOFA, DEPARTMENT OF PASSPORTS",
    candidate_place_of_birth: "Kathmandu",
    candidate_gender: "Male",

    employer_company_name: "Workers United DOO",
    employer_pib: "112233445",
    employer_address: "Bulevar Kralja Aleksandra 100",
    employer_representative_name: "Borivoje Petrovic",
    employer_mb: "21987654",
    employer_city: "Beograd",
    employer_director: "Borivoje Petrovic",
    employer_founding_date: "01.01.2024",
    employer_apr_number: "BD 12345/2024",

    job_title: "Pomoćni radnik u građevinarstvu",
    job_description_sr: "Utovar i istovar građevinskog materijala\nČišćenje i priprema gradilišta\nPomoć kvalifikovanim radnicima",
    job_description_en: "Loading and unloading construction materials\nCleaning and preparing the construction site\nAssisting qualified workers",
    salary_rsd: 55000,

    start_date: "2026-04-01",
    end_date: "2027-04-01",
    signing_date: "2026-03-15",

    contact_email: "contact@workersunited.eu",
    contact_phone: "+381 11 123 4567",

    accommodation_address: "Bulevar Oslobođenja 50, Beograd",
    signing_city: "Beograd",
};

async function main() {
    console.log("Generating sample PDFs...\n");

    const outputDir = path.join(process.cwd(), "sample-pdfs");
    mkdirSync(outputDir, { recursive: true });

    const docNames: Record<string, string> = {
        UGOVOR: "UGOVOR_O_RADU",
        IZJAVA: "IZJAVA_O_SAGLASNOSTI",
        OVLASCENJE: "OVLASCENJE",
        POZIVNO_PISMO: "POZIVNO_PISMO",
    };

    try {
        const docs = await generateAllDocuments(sampleData);

        for (const [docType, buffer] of docs) {
            const fileName = `${docNames[docType]}_SAMPLE.pdf`;
            const filePath = path.join(outputDir, fileName);
            writeFileSync(filePath, buffer);
            console.log(`✅ ${fileName} (${(buffer.length / 1024).toFixed(1)} KB)`);
        }

        console.log(`\n📁 All PDFs saved to: ${outputDir}`);
    } catch (error) {
        console.error("❌ Error generating PDFs:", error);
        process.exit(1);
    }
}

main();
