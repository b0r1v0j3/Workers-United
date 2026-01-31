export async function sendEmail(to: string, subject: string, htmlContent: string) {
    const apiKey = process.env.BREVO_API_KEY;

    if (!apiKey) {
        console.log("⚠️ [MOCK EMAIL] Brevo API Key missing. Logging email instead:");
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(`Content: ${htmlContent.substring(0, 50)}...`);
        return { success: true, mocked: true };
    }

    try {
        const res = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
                "accept": "application/json",
                "api-key": apiKey,
                "content-type": "application/json",
            },
            body: JSON.stringify({
                sender: { name: "Workers United", email: "no-reply@workersunited.eu" },
                to: [{ email: to }],
                subject,
                htmlContent,
            }),
        });

        if (!res.ok) {
            throw new Error(await res.text());
        }

        return { success: true };
    } catch (error) {
        console.error("Email Error:", error);
        return { success: false, error };
    }
}

export async function sendWelcomeEmail(to: string, companyName: string) {
    const subject = "Welcome to Workers United!";
    const html = `
    <h1>Welcome, ${companyName}!</h1>
    <p>We have received your registration. You can now post job requests.</p>
    <p>Our team will manually review your needs and find the best candidates.</p>
  `;
    return sendEmail(to, subject, html);
}

// RESTRICTED: Only logs to console for now
export async function sendMatchNotification(to: string, matchesCount: number) {
    console.log(`🚫 [BETA RESTRICTION] Match Notification suppressed for ${to}. matches: ${matchesCount}`);
    return { success: true, suppressed: true };
}
