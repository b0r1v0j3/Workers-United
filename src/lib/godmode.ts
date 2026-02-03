// God Mode configuration for development/testing
// Allows owner email to bypass verification steps and switch between roles

export const GOD_MODE_CONFIG = {
    // Owner email that gets god mode access
    ownerEmail: process.env.OWNER_EMAIL || "borivoje@workersunited.eu",

    // Enable god mode features
    isEnabled: process.env.NODE_ENV !== "production" || process.env.ENABLE_GOD_MODE === "true",
};

export function isGodModeUser(email: string | null | undefined): boolean {
    if (!email) return false;
    return GOD_MODE_CONFIG.isEnabled &&
        email.toLowerCase() === GOD_MODE_CONFIG.ownerEmail.toLowerCase();
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
