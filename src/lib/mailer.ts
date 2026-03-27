import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // TLS
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

export async function sendEmail(
    to: string,
    subject: string,
    html: string,
    replyTo?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        await transporter.sendMail({
            from: `"Workers United" <${process.env.SMTP_USER}>`,
            to,
            subject,
            html,
            ...(replyTo ? { replyTo } : {}),
        });
        return { success: true };
    } catch (error: unknown) {
        console.error("Email send error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Email send failed",
        };
    }
}
