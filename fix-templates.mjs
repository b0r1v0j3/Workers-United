/**
 * fix-templates.mjs
 * 
 * Ova skripta automatski popravlja SVE hardcoded vrednosti u DOCX šablonima.
 * DOCX fajlovi su ZIP arhive — skripta raspakuje, zameni tekst u XML-u, i ponovo zapakuje.
 * 
 * UPOTREBA:
 *   1. Zatvori SVA 4 šablona u LibreOffice/Word
 *   2. Pokreni: node fix-templates.mjs
 *   3. Otvori šablone da proveriš
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const TEMPLATES_DIR = path.join(process.cwd(), "public", "templates");
const TEMP_DIR = path.join(process.cwd(), ".template-fix-temp");

// Sve zamene koje treba uraditi u svakom šablonu
// Format: [hardcoded tekst, placeholder zamena]

const UGOVOR_REPLACEMENTS = [
    // Poslodavac hardcoded
    ["Tatjana Cvetković", "{EMPLOYER_DIRECTOR}"],
    ["Novi Sad, ul.", "{EMPLOYER_CITY}, ul."],
    ["Novi Sad municipality", "{EMPLOYER_CITY} municipality"],
    ["in Novi Sad", "in {EMPLOYER_CITY}"],
    ["Novom Sadu,", "{SIGNING_CITY},"],
    ["Novi Sad,", "{SIGNING_CITY},"],
    ["in Novi Sad", "in {SIGNING_CITY}"],
    ["PIB:  111413669", "PIB: {EMPLOYER_PIB}"],
    ["PIB: 111413669", "PIB: {EMPLOYER_PIB}"],
    ["111413669", "{EMPLOYER_PIB}"],
    ["Novog Sada", "{EMPLOYER_CITY}"],
    ["City of Novi Sad", "City of {EMPLOYER_CITY}"],
    ["Concluded in Novi Sad", "Concluded in {SIGNING_CITY}"],
    // Plata hardcoded  
    ["RSD 60.000,00", "RSD {SALARY_RSD}"],
    ["RSD 60,000.00", "RSD {SALARY_RSD}"],
    ["60.000,00", "{SALARY_RSD}"],
    ["60,000.00", "{SALARY_RSD}"],
];

const IZJAVA_REPLACEMENTS = [
    ["21000 Novi Sad", "{EMPLOYER_CITY}"],
    ["21000, Novi Sad", "{EMPLOYER_CITY}"],
];

const OVLASCENJE_REPLACEMENTS = [
    ["Novi Sad,", "{EMPLOYER_CITY},"],
    ["PIB 111413669", "PIB {EMPLOYER_PIB}"],
    ["PIB  111413669", "PIB {EMPLOYER_PIB}"],
    ["111413669", "{EMPLOYER_PIB}"],
    ["30.04.2019", "{EMPLOYER_FOUNDING_DATE}"],
    ["BD42470/2019", "{EMPLOYER_APR_NUMBER}"],
];

const POZIVNO_REPLACEMENTS = [
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

function cleanTemp() {
    if (fs.existsSync(TEMP_DIR)) {
        fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    }
}

function extractDocx(docxPath, extractDir) {
    fs.mkdirSync(extractDir, { recursive: true });
    // Use PowerShell Expand-Archive
    execSync(
        `powershell -Command "Expand-Archive -Path '${docxPath}' -DestinationPath '${extractDir}' -Force"`,
        { stdio: "pipe" }
    );
}

function repackDocx(extractDir, docxPath) {
    // Delete original
    if (fs.existsSync(docxPath)) {
        fs.unlinkSync(docxPath);
    }
    // Use PowerShell Compress-Archive
    execSync(
        `powershell -Command "Compress-Archive -Path '${extractDir}\\*' -DestinationPath '${docxPath}' -Force"`,
        { stdio: "pipe" }
    );
    // Rename .zip to .docx if needed
    const zipPath = docxPath.replace(/\.docx$/, ".zip");
    if (fs.existsSync(zipPath) && !fs.existsSync(docxPath)) {
        fs.renameSync(zipPath, docxPath);
    }
}

function replaceInXml(xmlContent, replacements) {
    let modified = xmlContent;
    let changeCount = 0;

    for (const [search, replace] of replacements) {
        // In DOCX XML, text might be split across <w:t> elements
        // But for simple hardcoded strings, they're usually in single <w:t> elements
        if (modified.includes(search)) {
            modified = modified.replaceAll(search, replace);
            changeCount++;
            console.log(`   ✅ "${search}" → "${replace}"`);
        }
    }

    return { modified, changeCount };
}

function processTemplate(template) {
    const docxPath = path.join(TEMPLATES_DIR, template.file);
    const extractDir = path.join(TEMP_DIR, template.file.replace(".docx", ""));

    console.log(`\n📄 ${template.file}`);
    console.log("─".repeat(50));

    if (!fs.existsSync(docxPath)) {
        console.log(`   ❌ Fajl ne postoji: ${docxPath}`);
        return false;
    }

    try {
        // Extract
        extractDocx(docxPath, extractDir);

        // Read document.xml
        const xmlPath = path.join(extractDir, "word", "document.xml");
        if (!fs.existsSync(xmlPath)) {
            console.log(`   ❌ word/document.xml ne postoji`);
            return false;
        }

        let xmlContent = fs.readFileSync(xmlPath, "utf-8");

        // Apply replacements
        const { modified, changeCount } = replaceInXml(xmlContent, template.replacements);

        if (changeCount === 0) {
            console.log("   ℹ️  Nema promena (možda su već zamenjene ili tekst je podeljen u XML-u)");
            return false;
        }

        // Write modified XML
        fs.writeFileSync(xmlPath, modified, "utf-8");

        // Repack
        repackDocx(extractDir, docxPath);
        console.log(`   ✅ Sačuvano! (${changeCount} zamena)`);
        return true;
    } catch (err) {
        console.error(`   ❌ Greška: ${err.message}`);
        return false;
    }
}

// ─── Main ────────────────────────────────────────────────────────────────────

console.log("🔧 DOCX Template Fixer");
console.log("═".repeat(50));
console.log(`Folder: ${TEMPLATES_DIR}`);

cleanTemp();
fs.mkdirSync(TEMP_DIR, { recursive: true });

let totalFixed = 0;
for (const template of ALL_TEMPLATES) {
    if (processTemplate(template)) {
        totalFixed++;
    }
}

cleanTemp();

console.log("\n" + "═".repeat(50));
if (totalFixed > 0) {
    console.log(`✅ Gotovo! Popravljeno ${totalFixed} šablon(a).`);
    console.log("Otvori šablone u LibreOffice da proveriš.");
} else {
    console.log("⚠️  Nijedan šablon nije izmenjen.");
    console.log("Mogući razlozi:");
    console.log("  - Fajlovi su otvoreni u LibreOffice (zatvori ih pa ponovo pokreni)");
    console.log("  - Tekst je podeljen u XML runs (treba ručno u LibreOffice)");
}
