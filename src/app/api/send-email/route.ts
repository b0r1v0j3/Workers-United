import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
            // Don't fail - we still want to try sending the email
        }

        // Send email using Web3Forms (free tier, no API key needed for basic usage)
        // Or you can integrate with Resend, SendGrid, etc.
        const emailResponse = await fetch("https://api.web3forms.com/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                access_key: process.env.WEB3FORMS_ACCESS_KEY || "YOUR_ACCESS_KEY",
                subject: `New ${role} inquiry from ${name}`,
                from_name: "Workers United Website",
                to: "contact@workersunited.eu",
                name,
                email,
                phone,
                country,
                role,
                job_preference,
                message
            })
        });

        const emailResult = await emailResponse.json();

        if (emailResult.success) {
            return NextResponse.json({ success: true });
        } else {
            // Even if email fails, we stored in DB, so partial success
            console.error("Email send error:", emailResult);
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
