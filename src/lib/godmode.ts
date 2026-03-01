// God Mode configuration
// Allows owner email to bypass verification steps and switch between roles

export const GOD_MODE_CONFIG = {
    // Owner email that gets god mode access — MUST be set via env var in production
    ownerEmail: process.env.OWNER_EMAIL || "",

    // Enable god mode features — defaults to DISABLED unless explicitly enabled
    isEnabled: process.env.GODMODE_ENABLED === "true",
};

export function isGodModeUser(email: string | null | undefined): boolean {
    if (!email) return false;
    if (!GOD_MODE_CONFIG.isEnabled) return false;
    if (!GOD_MODE_CONFIG.ownerEmail) return false;
    return email.toLowerCase() === GOD_MODE_CONFIG.ownerEmail.toLowerCase();
}

// God mode permissions
export const GOD_MODE_PERMISSIONS = {
    skipDocumentVerification: true,
    skipPayment: true,
    viewAsWorker: true,
    viewAsEmployer: true,
    viewAsAdmin: true,
    bypassQueue: true,
};
