import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/mailer";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, email, phone, country, role, job_preference, message } = body;

        // Validate required fields
        if (!name || !email || !phone || !message) {
            return NextResponse.json(
                { success: false, message: "Please fill in all required fields." },
                { status: 400 }
            );
        }

        // Store in Supabase
        const supabase = await createClient();

        const { error: dbError } = await supabase
            .from("contact_submissions")
            .insert({
                name,
                email,
                phone,
                country: country || null,
                role,
                job_preference: job_preference || null,
                message,
                created_at: new Date().toISOString()
            });

        if (dbError) {
            console.error("Database error:", dbError);
        }

        // Send notification email via Google Workspace SMTP
        const html = `
            <h2>New ${role} inquiry</h2>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Phone:</strong> ${phone}</p>
            ${country ? `<p><strong>Country:</strong> ${country}</p>` : ""}
            ${job_preference ? `<p><strong>Job Preference:</strong> ${job_preference}</p>` : ""}
            <p><strong>Message:</strong></p>
            <p>${message}</p>
        `;

        const result = await sendEmail(
            process.env.SMTP_USER || "contact@workersunited.eu",
            `New ${role} inquiry from ${name}`,
            html,
            email // reply-to the person who submitted
        );

        if (result.success) {
            return NextResponse.json({ success: true });
        } else {
            // Even if email fails, we stored in DB
            console.error("Email send error:", result.error);
            return NextResponse.json({
                success: true,
                message: "Your message was received. We will contact you soon."
            });
        }
    } catch (error) {
        console.error("Contact form error:", error);
        return NextResponse.json(
            { success: false, message: "Server error. Please try again later." },
            { status: 500 }
        );
    }
}
