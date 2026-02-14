/**
 * fix-templates.mjs
 * 
 * Popravlja SVE hardcoded vrednosti u DOCX šablonima.
 * 
 * UPOTREBA: node fix-templates.mjs
 */

import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";

const TEMPLATES_DIR = path.join(process.cwd(), "public", "templates");

const UGOVOR_REPLACEMENTS = [
    ["Tatjana Cvetković", "{EMPLOYER_DIRECTOR}"],
    ["Tatjana Cvetkovi\u0107", "{EMPLOYER_DIRECTOR}"],
    // PIB
    ["PIB:  111413669", "PIB: {EMPLOYER_PIB}"],
    ["PIB: 111413669", "PIB: {EMPLOYER_PIB}"],
    ["PIB:111413669", "PIB:{EMPLOYER_PIB}"],
    // Tax identification
    ["Tax identification No: 111413669", "Tax identification No: {EMPLOYER_PIB}"],
    ["Tax identification No:111413669", "Tax identification No:{EMPLOYER_PIB}"],
    // Standalone PIB number (after more specific replacements already ran)
    ["111413669", "{EMPLOYER_PIB}"],
    // City - specific contexts first
    ["Concluded in Novi Sad", "Concluded in {SIGNING_CITY}"],
    ["City of Novi Sad", "City of {EMPLOYER_CITY}"],
    ["Novi Sad municipality", "{EMPLOYER_CITY} municipality"],
    ["u Novom Sadu", "u {SIGNING_CITY}"],
    ["Novom Sadu", "{SIGNING_CITY}"],
    ["Novog Sada", "{EMPLOYER_CITY}"],
    // Salary
    ["RSD 60.000,00", "RSD {SALARY_RSD}"],
    ["60.000,00", "{SALARY_RSD}"],
    ["RSD 60,000.00", "RSD {SALARY_RSD}"],
    ["60,000.00", "{SALARY_RSD}"],
];

const IZJAVA_REPLACEMENTS = [
    ["21000 Novi Sad", "{EMPLOYER_CITY}"],
    ["21000, Novi Sad", "{EMPLOYER_CITY}"],
];

const OVLASCENJE_REPLACEMENTS = [
    ["PIB 111413669", "PIB {EMPLOYER_PIB}"],
    ["PIB  111413669", "PIB {EMPLOYER_PIB}"],
    ["111413669", "{EMPLOYER_PIB}"],
    ["30.04.2019", "{EMPLOYER_FOUNDING_DATE}"],
    ["BD42470/2019", "{EMPLOYER_APR_NUMBER}"],
    ["Novi Sad,", "{EMPLOYER_CITY},"],
];

const POZIVNO_REPLACEMENTS = [
    ["PARTIZANSKA BR. 28, NOVI SAD \u2013 KA\u0106", "{ACCOMMODATION_ADDRESS}"],
    ["PARTIZANSKA BR. 28, NOVI SAD – KAĆ", "{ACCOMMODATION_ADDRESS}"],
    ["PARTIZANSKA BR. 28, NOVI SAD", "{ACCOMMODATION_ADDRESS}"],
    ["Partizanska br. 28, Novi Sad", "{ACCOMMODATION_ADDRESS}"],
    ["Novom sadu", "{SIGNING_CITY}"],
    ["Novom Sadu", "{SIGNING_CITY}"],
];

const ALL_TEMPLATES = [
    { file: "UGOVOR_O_RADU.docx", replacements: UGOVOR_REPLACEMENTS },
    { file: "IZJAVA_O_SAGLASNOSTI.docx", replacements: IZJAVA_REPLACEMENTS },
    { file: "OVLASCENJE.docx", replacements: OVLASCENJE_REPLACEMENTS },
    { file: "POZIVNO_PISMO.docx", replacements: POZIVNO_REPLACEMENTS },
];

function processTemplate(template) {
    const docxPath = path.join(TEMPLATES_DIR, template.file);

    console.log(`\n📄 ${template.file}`);
    console.log("─".repeat(50));

    if (!fs.existsSync(docxPath)) {
        console.log(`   ❌ Fajl ne postoji`);
        return false;
    }

    try {
        const zip = new AdmZip(docxPath);
        const xmlEntry = zip.getEntry("word/document.xml");

        if (!xmlEntry) {
            console.log(`   ❌ word/document.xml ne postoji u ZIP-u`);
            return false;
        }

        let xmlContent = xmlEntry.getData().toString("utf-8");
        let changeCount = 0;

        for (const [search, replace] of template.replacements) {
            if (xmlContent.includes(search)) {
                xmlContent = xmlContent.replaceAll(search, replace);
                changeCount++;
                console.log(`   ✅ "${search}" → "${replace}"`);
            }
        }

        if (changeCount === 0) {
            console.log("   ℹ️  Nema promena (tekst možda podeljen u XML runs)");
            return false;
        }

        // Write modified XML back
        zip.updateFile("word/document.xml", Buffer.from(xmlContent, "utf-8"));
        zip.writeZip(docxPath);
        console.log(`   ✅ Sačuvano! (${changeCount} zamena)`);
        return true;
    } catch (err) {
        console.error(`   ❌ Greška: ${err.message}`);
        if (err.message.includes("EBUSY") || err.message.includes("being used")) {
            console.log("   ⚠️  Zatvori fajl u LibreOffice pa probaj ponovo!");
        }
        return false;
    }
}

console.log("🔧 DOCX Template Fixer");
console.log("═".repeat(50));

let totalFixed = 0;
for (const template of ALL_TEMPLATES) {
    if (processTemplate(template)) {
        totalFixed++;
    }
}

console.log("\n" + "═".repeat(50));
if (totalFixed > 0) {
    console.log(`✅ Gotovo! Popravljeno ${totalFixed} šablon(a).`);
    console.log("Otvori šablone u LibreOffice da proveriš.");
} else {
    console.log("⚠️  Nijedan šablon nije izmenjen.");
    console.log("Zatvori sve DOCX fajlove u LibreOffice pa ponovo pokreni.");
}
