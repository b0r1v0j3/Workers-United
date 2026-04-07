"""
Fix Diamond Star / SoundLink worker documents.
Replaces incorrect name/surname data in existing PDFs using PyMuPDF redaction.
Preserves all signatures and other content.
"""

import fitz  # PyMuPDF
import os
import sys
import glob
import tempfile
import shutil

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# ─── Per-worker text replacements ───────────────────────────────────────────
# Each worker has specific wrong→correct text mappings.
# For Pozivno Pismo: ИМЕ/NAME field has WRONG given name, ПРЕЗИМЕ/SURNAME has WRONG surname.
# For Ugovor/Ovlascenje/Izjava: full name is used in various places.
#
# Strategy: define exact replacements per worker that cover all document types.
# We replace whole phrases to avoid collateral replacements.

WORKER_REPLACEMENTS = {
    "AAKASH CHAUDHARY": [
        # Pozivno Pismo: ИМЕ value "CHAUDHARY" → "AAKASH", ПРЕЗИМЕ value "AAKASH" → "CHAUDHARY"
        # But we can't just swap blindly - CHAUDHARY also appears correctly in other docs.
        # Strategy: Use contextual approach - replace "CHAUDHARY" only when it's the NAME value
        # In Ugovor: "CHAUDHARY AAKASH" (wrong full name) → "AAKASH CHAUDHARY"
        ("CHAUDHARY AAKASH", "AAKASH CHAUDHARY"),
    ],
    "BIKALP CHAUDHARY": [
        ("CHAUDHARY BIKALP", "BIKALP CHAUDHARY"),
    ],
    "BIMAL DAHIT": [
        ("DAHIT BIMAL", "BIMAL DAHIT"),
    ],
    "GANESH KUMAR KHATRI": [
        # Full name in Ugovor: "KHATRI GANESH KUMAR" → "GANESH KUMAR KHATRI"
        ("KHATRI GANESH KUMAR", "GANESH KUMAR KHATRI"),
        # Pozivno Pismo ИМЕ: "KHATRI GANESH" → will be handled by full name fix
        ("KHATRI GANESH", "GANESH KUMAR"),
    ],
    "NABIN DAHIT DANGAURA": [
        # Full name: "DANGRAU NABIN KUMAR" → "NABIN KUMAR DAHIT DANGAURA"
        ("DANGRAU NABIN KUMAR", "NABIN KUMAR DAHIT DANGAURA"),
        # Pozivno Pismo ИМЕ: "DANGRAU NABIN" → "NABIN KUMAR"
        ("DANGRAU NABIN", "NABIN KUMAR"),
        # Pozivno Pismo ПРЕЗИМЕ: "KUMAR" → "DAHIT DANGAURA" (only after given name is fixed)
        # But "KUMAR" alone is too ambiguous. Let's handle this carefully.
    ],
    "NIRAJ CHAUDHARY": [
        ("CHAUDHARY NIRAJ", "NIRAJ CHAUDHARY"),
    ],
    "PRABIN RAI": [
        ("RAI PRABIN", "PRABIN RAI"),
    ],
    "PRAMOD DANGAURA": [
        ("DANGAURA PRAMOD", "PRAMOD DANGAURA"),
        # DOB fix: 22.08.1999 → 24.08.1999
        ("22.08.1999", "24.08.1999"),
    ],
    "SANJU DANGAURA": [
        # Full name "DANGRAU SANJU" → "SANJU DANGAURA"
        ("DANGRAU SANJU", "SANJU DANGAURA"),
        # Standalone "DANGRAU" (misspelling) in ИМЕ field → "SANJU"
        # But we need to be careful - "DANGRAU SANJU" should be caught first
    ],
    "SMILE CHAUDHARY": [
        ("CHAUDHARY SMILE", "SMILE CHAUDHARY"),
    ],
    "SUDIP DANGAURA": [
        ("DANGAURA SUDIP", "SUDIP DANGAURA"),
    ],
}

# Additional single-field fixes for Pozivno Pismo
# These handle the ИМЕ and ПРЕЗИМЕ fields which show individual values (not full name)
# Format: { worker_key: [(wrong_standalone, correct_standalone, context_hint)] }
POZIVNO_FIXES = {
    "AAKASH CHAUDHARY": [
        # In Pozivno Pismo ИМЕ row: shows "CHAUDHARY" (should be "AAKASH")
        # In Pozivno Pismo ПРЕЗИМЕ row: shows "AAKASH" (should be "CHAUDHARY")
        # These are standalone values that don't appear as "CHAUDHARY AAKASH" together
    ],
    "NABIN DAHIT DANGAURA": [
        # After "DANGRAU NABIN" is replaced with "NABIN KUMAR",
        # the standalone "KUMAR" in ПРЕЗИМЕ should become "DAHIT DANGAURA"
    ],
}


def fix_pdf_smart(filepath, worker_key):
    """Fix a single PDF using smart text replacement approach."""
    replacements = WORKER_REPLACEMENTS.get(worker_key, [])
    if not replacements:
        return 0

    doc = fitz.open(filepath)
    total_changes = 0

    for page_num in range(len(doc)):
        page = doc[page_num]
        page_changes = 0

        # Apply replacements in order (longest first to avoid partial matches)
        sorted_replacements = sorted(replacements, key=lambda x: len(x[0]), reverse=True)

        for wrong_text, correct_text in sorted_replacements:
            areas = page.search_for(wrong_text)
            if areas:
                for area in areas:
                    # Expand area slightly to ensure complete coverage
                    expanded = fitz.Rect(
                        area.x0 - 1,
                        area.y0 - 1,
                        area.x1 + 40,  # extra width for potentially longer replacement
                        area.y1 + 1
                    )

                    # Determine font size from area
                    font_size = (area.y1 - area.y0) * 0.72  # approximate

                    page.add_redact_annot(
                        expanded,
                        text=correct_text,
                        fontsize=font_size,
                        fontname="helv",
                        text_color=(0, 0, 0),
                        fill=(1, 1, 1),
                    )
                    page_changes += 1

        # Now handle Pozivno Pismo specific: swap the standalone ИМЕ/ПРЕЗИМЕ values
        # These appear as separate text elements that aren't part of the full name
        page_text = page.get_text()
        is_pozivno = "ПОЗИВНО ПИСМО" in page_text or "POZIVNO" in os.path.basename(filepath).upper()

        if is_pozivno and worker_key in POZIVNO_SWAP_DATA:
            swap = POZIVNO_SWAP_DATA[worker_key]
            # Only apply if the wrong values still exist (not already caught by full-name replacement)
            wrong_name_areas = page.search_for(swap["wrong_in_name"])
            wrong_surname_areas = page.search_for(swap["wrong_in_surname"])

            if wrong_name_areas and wrong_surname_areas:
                # Find which areas are in the name/surname field region (y position ~215 and ~233)
                for area in wrong_name_areas:
                    if 210 < area.y0 < 230:  # ИМЕ row region
                        expanded = fitz.Rect(area.x0 - 1, area.y0 - 1, area.x1 + 40, area.y1 + 1)
                        font_size = (area.y1 - area.y0) * 0.72
                        page.add_redact_annot(
                            expanded, text=swap["correct_name"],
                            fontsize=font_size, fontname="helv",
                            text_color=(0, 0, 0), fill=(1, 1, 1),
                        )
                        page_changes += 1

                for area in wrong_surname_areas:
                    if 228 < area.y0 < 250:  # ПРЕЗИМЕ row region
                        expanded = fitz.Rect(area.x0 - 1, area.y0 - 1, area.x1 + 40, area.y1 + 1)
                        font_size = (area.y1 - area.y0) * 0.72
                        page.add_redact_annot(
                            expanded, text=swap["correct_surname"],
                            fontsize=font_size, fontname="helv",
                            text_color=(0, 0, 0), fill=(1, 1, 1),
                        )
                        page_changes += 1

        if page_changes > 0:
            page.apply_redactions()
            total_changes += page_changes

    if total_changes > 0:
        temp_path = filepath + ".tmp"
        doc.save(temp_path, deflate=True, garbage=4)
        doc.close()
        os.replace(temp_path, filepath)
        print(f"    FIXED ({total_changes} changes): {os.path.basename(filepath)}")
    else:
        doc.close()
        print(f"    No changes: {os.path.basename(filepath)}")

    return total_changes


# Pozivno Pismo swap data: the standalone field values that need swapping
# Only used when the values weren't already caught by full-name replacements
POZIVNO_SWAP_DATA = {
    "AAKASH CHAUDHARY": {
        "wrong_in_name": "CHAUDHARY",      # currently in ИМЕ field
        "wrong_in_surname": "AAKASH",        # currently in ПРЕЗИМЕ field
        "correct_name": "AAKASH",            # should be in ИМЕ
        "correct_surname": "CHAUDHARY",      # should be in ПРЕЗИМЕ
    },
    "BIKALP CHAUDHARY": {
        "wrong_in_name": "CHAUDHARY",
        "wrong_in_surname": "BIKALP",
        "correct_name": "BIKALP",
        "correct_surname": "CHAUDHARY",
    },
    "BIMAL DAHIT": {
        "wrong_in_name": "DAHIT",
        "wrong_in_surname": "BIMAL",
        "correct_name": "BIMAL",
        "correct_surname": "DAHIT",
    },
    "GANESH KUMAR KHATRI": {
        "wrong_in_name": "KHATRI GANESH",
        "wrong_in_surname": "KUMAR",
        "correct_name": "GANESH KUMAR",
        "correct_surname": "KHATRI",
    },
    "NABIN DAHIT DANGAURA": {
        "wrong_in_name": "DANGRAU NABIN",
        "wrong_in_surname": "KUMAR",
        "correct_name": "NABIN KUMAR",
        "correct_surname": "DAHIT DANGAURA",
    },
    "NIRAJ CHAUDHARY": {
        "wrong_in_name": "CHAUDHARY",
        "wrong_in_surname": "NIRAJ",
        "correct_name": "NIRAJ",
        "correct_surname": "CHAUDHARY",
    },
    "PRABIN RAI": {
        "wrong_in_name": "RAI",
        "wrong_in_surname": "PRABIN",
        "correct_name": "PRABIN",
        "correct_surname": "RAI",
    },
    "PRAMOD DANGAURA": {
        "wrong_in_name": "DANGAURA",
        "wrong_in_surname": "PRAMOD",
        "correct_name": "PRAMOD",
        "correct_surname": "DANGAURA",
    },
    "SANJU DANGAURA": {
        "wrong_in_name": "DANGRAU",
        "wrong_in_surname": "SANJU",
        "correct_name": "SANJU",
        "correct_surname": "DANGAURA",
    },
    "SMILE CHAUDHARY": {
        "wrong_in_name": "CHAUDHARY",
        "wrong_in_surname": "SMILE",
        "correct_name": "SMILE",
        "correct_surname": "CHAUDHARY",
    },
    "SUDIP DANGAURA": {
        "wrong_in_name": "DANGAURA",
        "wrong_in_surname": "SUDIP",
        "correct_name": "SUDIP",
        "correct_surname": "DANGAURA",
    },
}


def find_worker_key(filename):
    """Match a filename to a worker key."""
    filename_upper = filename.upper()
    for key in sorted(WORKER_REPLACEMENTS.keys(), key=len, reverse=True):
        if key.upper() in filename_upper:
            return key
    return None


def process_folder(folder_path, description):
    """Process all PDFs in a folder."""
    print(f"\n{'='*60}")
    print(f"{description}")
    print(f"{'='*60}")

    if not os.path.exists(folder_path):
        print(f"  FOLDER NOT FOUND: {folder_path}")
        return 0

    total = 0
    for pdf_path in sorted(glob.glob(os.path.join(folder_path, "*.pdf"))):
        filename = os.path.basename(pdf_path)
        if filename.startswith("_") or filename in ("IZJAVA_POSLODAVCA.pdf", "need signature.zip", "treba da se potpise bratski.zip"):
            continue

        worker_key = find_worker_key(filename)
        if not worker_key:
            continue

        try:
            total += fix_pdf_smart(pdf_path, worker_key)
        except Exception as e:
            print(f"    ERROR {filename}: {e}")

    return total


def process_aplikacije(base_path):
    """Process per-worker APLIKACIJE subfolders."""
    print(f"\n{'='*60}")
    print(f"APLIKACIJE (per-worker folders)")
    print(f"{'='*60}")

    total = 0
    for worker_key in WORKER_REPLACEMENTS:
        worker_folder = os.path.join(base_path, worker_key)
        if not os.path.exists(worker_folder):
            print(f"  Folder not found: {worker_key}")
            continue

        print(f"\n  --- {worker_key} ---")
        for pdf_path in sorted(glob.glob(os.path.join(worker_folder, "*.pdf"))):
            filename = os.path.basename(pdf_path)
            skip = ("IZVOD_O_REGISTRACIJI", "IZJAVA_POSLODAVCA", "DIPLOMA_PREVEDENA")
            if any(s in filename for s in skip):
                continue

            try:
                total += fix_pdf_smart(pdf_path, worker_key)
            except Exception as e:
                print(f"    ERROR {filename}: {e}")

    return total


def main():
    BASE = r"C:\Users\BORIVOJE\Desktop\Diamond Star Overseas Pvt. Ltd. - Diplomas\Soundlink - Contracts"

    total = 0
    total += process_folder(os.path.join(BASE, "1 - Worker Sign"), "1 - Worker Sign")
    total += process_folder(os.path.join(BASE, "2 - Employer Sign"), "2 - Employer Sign (unsigned)")
    total += process_folder(os.path.join(BASE, "2 - Employer Sign", "Signed"), "2 - Employer Sign / Signed")
    total += process_folder(os.path.join(BASE, "SIGNED DOCUMENTS", "SIGNED"), "SIGNED DOCUMENTS / SIGNED")
    total += process_aplikacije(os.path.join(BASE, "APLIKACIJE"))

    print(f"\n{'='*60}")
    print(f"TOTAL REPLACEMENTS: {total}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
