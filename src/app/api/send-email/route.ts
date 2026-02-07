import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/mailer";
import { callGeminiText } from "@/lib/gemini";

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

        // Send notification email to admin via SMTP
        const adminHtml = `
            <h2>New ${role} inquiry</h2>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Phone:</strong> ${phone}</p>
            ${country ? `<p><strong>Country:</strong> ${country}</p>` : ""}
            ${job_preference ? `<p><strong>Job Preference:</strong> ${job_preference}</p>` : ""}
            <p><strong>Message:</strong></p>
            <p>${message}</p>
        `;

        await sendEmail(
            process.env.SMTP_USER || "contact@workersunited.eu",
            `New ${role} inquiry from ${name}`,
            adminHtml,
            email
        );

        // Generate AI auto-reply and send to person
        try {
            const aiPrompt = `You are the AI assistant for Workers United (workersunited.eu), an international recruitment and visa support company.
A ${role} named ${name} from ${country || "unknown country"} sent a contact form message:

"${message}"

${job_preference ? `They are interested in: ${job_preference}` : ""}

Write a professional, warm, and helpful reply email. Guidelines:
- Thank them for reaching out
- Address their specific question/concern directly
- If they are a WORKER: explain that they should create a free account at workersunited.eu/signup to get started, complete their profile and upload documents, and our team will review their application
- If they are an EMPLOYER: explain that they should create an employer account at workersunited.eu/signup, complete their company profile, and post their job requirements
- Keep it concise (3-4 short paragraphs max)
- Be honest — don't make promises you can't keep
- Sign off as "Workers United Team"
- Do NOT include any email subject line, just the body text
- Write in plain text, no markdown or HTML formatting`;

            const aiReply = await callGeminiText(aiPrompt);

            // Format the AI reply as HTML email
            const replyHtml = `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; color: #1b2430;">
                    <div style="background: linear-gradient(135deg, #2f6fed, #1c4dd6); padding: 24px; border-radius: 12px 12px 0 0;">
                        <h1 style="color: white; margin: 0; font-size: 20px;">Workers United</h1>
                        <p style="color: rgba(255,255,255,0.85); margin: 4px 0 0; font-size: 14px;">International Hiring Made Simple & Legal</p>
                    </div>
                    <div style="padding: 24px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;">
                        <p style="margin-top: 0;">Dear ${name},</p>
                        ${aiReply.split("\n").filter(l => l.trim()).map(line => `<p style="line-height: 1.6; margin: 12px 0;">${line}</p>`).join("")}
                    </div>
                    <div style="padding: 16px 24px; background: #f8fafc; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
                        <p style="margin: 0; font-size: 12px; color: #6c7a89;">
                            Workers United LLC · 75 E 3rd St., Sheridan, Wyoming 82801, USA<br>
                            <a href="https://workersunited.eu" style="color: #2f6fed;">workersunited.eu</a> · 
                            <a href="mailto:contact@workersunited.eu" style="color: #2f6fed;">contact@workersunited.eu</a>
                        </p>
                    </div>
                </div>
            `;

            await sendEmail(
                email,
                `Re: Your inquiry to Workers United`,
                replyHtml
            );

            console.log(`AI auto-reply sent to ${email}`);
        } catch (aiErr) {
            // AI reply failure should not block the main flow
            console.error("AI auto-reply failed:", aiErr);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Contact form error:", error);
        return NextResponse.json(
            { success: false, message: "Server error. Please try again later." },
            { status: 500 }
        );
    }
}
