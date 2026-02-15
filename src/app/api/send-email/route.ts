import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/mailer";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, email, phone, country, role, job_preference, message } = body;

        // Basic validation
        if (!name || !email || !phone) {
            return NextResponse.json(
                { success: false, message: "Name, email, and phone are required." },
                { status: 400 }
            );
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json(
                { success: false, message: "Invalid email address." },
                { status: 400 }
            );
        }

        const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER;
        if (!adminEmail) {
            console.error("No ADMIN_EMAIL or SMTP_USER configured for contact form");
            return NextResponse.json(
                { success: false, message: "Server configuration error." },
                { status: 500 }
            );
        }

        const roleLabel = role === "employer" ? "Employer" : "Worker";

        const htmlContent = `
            <h2>New Contact Form Submission</h2>
            <table style="border-collapse: collapse; width: 100%;">
                <tr><td style="padding: 8px; font-weight: bold;">Name:</td><td style="padding: 8px;">${name}</td></tr>
                <tr><td style="padding: 8px; font-weight: bold;">Email:</td><td style="padding: 8px;">${email}</td></tr>
                <tr><td style="padding: 8px; font-weight: bold;">Phone:</td><td style="padding: 8px;">${phone}</td></tr>
                ${country ? `<tr><td style="padding: 8px; font-weight: bold;">Country:</td><td style="padding: 8px;">${country}</td></tr>` : ""}
                <tr><td style="padding: 8px; font-weight: bold;">Role:</td><td style="padding: 8px;">${roleLabel}</td></tr>
                ${job_preference ? `<tr><td style="padding: 8px; font-weight: bold;">Job Preference:</td><td style="padding: 8px;">${job_preference}</td></tr>` : ""}
                ${message ? `<tr><td style="padding: 8px; font-weight: bold;">Message:</td><td style="padding: 8px;">${message}</td></tr>` : ""}
            </table>
        `;

        const result = await sendEmail(
            adminEmail,
            `[Workers United] Contact: ${name} (${roleLabel})`,
            htmlContent,
            email // Reply-to the sender
        );

        if (result.success) {
            return NextResponse.json({ success: true });
        } else {
            console.error("Failed to send contact email:", result.error);
            return NextResponse.json(
                { success: false, message: "Failed to send message. Please try again." },
                { status: 500 }
            );
        }
    } catch (error) {
        console.error("Contact form error:", error);
        return NextResponse.json(
            { success: false, message: "An unexpected error occurred." },
            { status: 500 }
        );
    }
}
