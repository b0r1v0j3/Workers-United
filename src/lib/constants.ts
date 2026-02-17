// Shared constants across the application

// ─── WORLD COUNTRIES ─────────────────────────────────────────
// Used for birth country, citizenship, etc.
export const WORLD_COUNTRIES = [
    "Afghanistan", "Albania", "Algeria", "Andorra", "Angola",
    "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan",
    "Bahrain", "Bangladesh", "Belarus", "Belgium", "Bolivia",
    "Bosnia and Herzegovina", "Brazil", "Brunei", "Bulgaria", "Cameroon",
    "Canada", "Chile", "China", "Colombia", "Congo",
    "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czech Republic",
    "Denmark", "Dominican Republic", "Ecuador", "Egypt", "El Salvador",
    "Estonia", "Ethiopia", "Finland", "France", "Georgia",
    "Germany", "Ghana", "Greece", "Guatemala", "Honduras",
    "Hungary", "Iceland", "India", "Indonesia", "Iran",
    "Iraq", "Ireland", "Israel", "Italy", "Jamaica",
    "Japan", "Jordan", "Kazakhstan", "Kenya",
    "Kuwait", "Kyrgyzstan", "Latvia", "Lebanon", "Libya",
    "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar", "Malaysia",
    "Mali", "Malta", "Mexico", "Moldova", "Monaco",
    "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar",
    "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger",
    "Nigeria", "North Korea", "North Macedonia", "Norway", "Oman",
    "Pakistan", "Palestine", "Panama", "Paraguay", "Peru",
    "Philippines", "Poland", "Portugal", "Qatar", "Romania",
    "Russia", "Rwanda", "San Marino", "Saudi Arabia", "Senegal",
    "Serbia", "Singapore", "Slovakia", "Slovenia", "Somalia",
    "South Africa", "South Korea", "Spain", "Sri Lanka", "Sudan",
    "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan",
    "Tanzania", "Thailand", "Tunisia", "Turkey", "Turkmenistan",
    "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States",
    "Uruguay", "Uzbekistan", "Vatican City", "Venezuela", "Vietnam",
    "Yemen", "Zambia", "Zimbabwe"
];

// ─── EUROPEAN COUNTRIES ──────────────────────────────────────
// Used for employer country selection
export const EUROPEAN_COUNTRIES = [
    "Albania", "Andorra", "Austria", "Belarus", "Belgium",
    "Bosnia and Herzegovina", "Bulgaria", "Croatia", "Cyprus", "Czech Republic",
    "Denmark", "Estonia", "Finland", "France", "Germany",
    "Greece", "Hungary", "Iceland", "Ireland", "Italy",
    "Latvia", "Liechtenstein", "Lithuania", "Luxembourg",
    "Malta", "Moldova", "Monaco", "Montenegro", "Netherlands",
    "North Macedonia", "Norway", "Poland", "Portugal", "Romania",
    "Russia", "San Marino", "Serbia", "Slovakia", "Slovenia",
    "Spain", "Sweden", "Switzerland", "Turkey", "Ukraine",
    "United Kingdom"
];

// ─── INDUSTRIES ──────────────────────────────────────────────
// Worker list includes "Any" (open to all jobs)
export const WORKER_INDUSTRIES = [
    "Construction",
    "Manufacturing",
    "Agriculture",
    "Hospitality",
    "Transportation",
    "Retail",
    "Food Processing",
    "Warehousing & Logistics",
    "Cleaning Services",
    "Driving",
    "Any"
];

// Employer list — no "Any" (they must specify what they need)
export const EMPLOYER_INDUSTRIES = [
    "Construction",
    "Manufacturing",
    "Agriculture",
    "Hospitality",
    "Transportation",
    "Retail",
    "Food Processing",
    "Warehousing & Logistics",
    "Cleaning Services",
    "Driving",
    "Other"
];

// Backwards-compatible alias
export const INDUSTRIES = EMPLOYER_INDUSTRIES;

// ─── MARITAL STATUS ──────────────────────────────────────────
export const MARITAL_STATUSES = [
    "Single",
    "Married",
    "Divorced",
    "Widowed",
    "Separated",
    "Other"
];

// ─── GENDER OPTIONS ──────────────────────────────────────────
export const GENDER_OPTIONS = [
    "Male",
    "Female"
];

// ─── COMPANY SIZES ───────────────────────────────────────────
export const COMPANY_SIZES = [
    "1-10 employees",
    "11-50 employees",
    "51-200 employees",
    "201-500 employees",
    "500+ employees"
];

// ─── FILE UPLOAD LIMITS ──────────────────────────────────────
export const MAX_FILE_SIZE_MB = 10;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
export const COMPRESSED_IMAGE_QUALITY = 0.8;
export const COMPRESSED_MAX_WIDTH = 1920;
export const COMPRESSED_MAX_HEIGHT = 1920;
