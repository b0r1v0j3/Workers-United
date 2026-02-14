import AdmZip from "adm-zip";
import path from "path";

const zip = new AdmZip(path.join("public", "templates", "UGOVOR_O_RADU.docx"));
let xml = zip.getEntry("word/document.xml").getData().toString("utf-8");

let changes = 0;

// 1. Fix remaining "Novi Sad" -> "{EMPLOYER_CITY}"
if (xml.includes("Novi Sad")) {
    xml = xml.replaceAll("Novi Sad", "{EMPLOYER_CITY}");
    changes++;
    console.log("Fixed: Novi Sad -> {EMPLOYER_CITY}");
}

// 2. Remove old hardcoded job descriptions (they appear after placeholder section)
const oldTexts = [
    "mase, kao i korišćenje zaštitne opreme u skladu sa propisima.",
    "Pomoć pri pripremi i rasporedu materijala, utovar i istovar materijala ručno ili uz pomoć mehanizacije.",
    "Održavanje radne zone čistom i bezbednom, uz poštovanje svih pravila zaštite na radu.",
    "compounds, and using protective gear in compliance with safety regulations.",
    "Assisting in preparing and organizing materials, loading and unloading manually",
    "mechanical assistance.",
    "Keeping the work area clean and safe while strictly following workplace safety rules.",
];

for (const t of oldTexts) {
    if (xml.includes(t)) {
        xml = xml.replaceAll(t, "");
        changes++;
        console.log("Removed: " + t.substring(0, 40) + "...");
    }
}

if (changes > 0) {
    zip.updateFile("word/document.xml", Buffer.from(xml, "utf-8"));
    zip.writeZip(path.join("public", "templates", "UGOVOR_O_RADU.docx"));
    console.log("Saved! (" + changes + " changes)");
} else {
    console.log("No changes needed");
}

process.exit(0);
