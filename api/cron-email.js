// Cron Job API - Process Email Queue
// Called by Vercel Cron every 5 minutes

import { getEmailTemplate } from './email-template.js';

// Email Templates for different stages
const EMAIL_TEMPLATES = {
    review_complete: (name) => ({
        subject: '✅ Great News - Your Profile Has Been Reviewed!',
        body: `
      <h1>🎉 Congratulations, ${name}!</h1>
      <p>Dear ${name},</p>
      
      <div class="info-box">
        <strong>✅ Your Profile Has Been Approved!</strong><br>
        After reviewing your application, we are pleased to inform you that you qualify for our work visa program.
      </div>

      <h3>📋 Next Step: Document Submission</h3>
      <p>To proceed with your application, we need to verify your documents. Please click the button below to upload:</p>

      <ul style="line-height: 2;">
        <li>✅ <strong>Passport</strong> – Clear photo of data page (must be valid 1+ year)</li>
        <li>✅ <strong>Passport Photo</strong> – Recent photo with white background</li>
        <li>✅ <strong>Diploma/Certificate</strong> – Educational qualification</li>
      </ul>

      <p style="text-align: center; margin: 30px 0;">
        <a href="https://www.workersunited.eu/document-wizard.html?email={{EMAIL}}" 
           style="background-color: #10b981; color: white; padding: 15px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">
           📤 Upload Your Documents
        </a>
      </p>

      <p style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
        <strong>⏳ Important:</strong> Please complete this step within 7 days to keep your application active.
      </p>

      <p style="margin-top: 40px;"><strong>Best regards,</strong><br>The Workers United Team</p>
    `
    }),

    docs_approved: (name) => ({
        subject: '📄 Your Documents Have Been Verified!',
        body: `
      <h1>✅ Documents Approved, ${name}!</h1>
      <p>Dear ${name},</p>
      
      <div class="info-box">
        <strong>🎉 All Your Documents Have Been Verified!</strong><br>
        Our team has reviewed your passport, photo, and educational documents. Everything looks great!
      </div>

      <h3>🚀 Final Step: Join Our Waitlist</h3>
      <p>You're almost there! To be matched with employers and receive job offers, please join our priority waitlist:</p>

      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 12px; text-align: center; margin: 25px 0;">
        <h2 style="margin: 0; color: white;">Priority Waitlist - $9</h2>
        <p style="margin: 10px 0; opacity: 0.9;">One-time fee • 90-day money-back guarantee</p>
        <p style="font-size: 14px; margin-top: 15px;">If you don't receive a job offer within 90 days, you get a full refund!</p>
      </div>

      <p style="text-align: center; margin: 30px 0;">
        <a href="https://www.workersunited.eu/payment?email={{EMAIL}}" 
           style="background-color: #10b981; color: white; padding: 15px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">
           💳 Join Waitlist - $9
        </a>
      </p>

      <h3>What Happens Next?</h3>
      <ol style="line-height: 2;">
        <li>You join our priority candidate pool</li>
        <li>We match you with employers seeking your skills</li>
        <li>You receive job offers directly</li>
        <li>We assist with visa and relocation</li>
      </ol>

      <p style="margin-top: 40px;"><strong>Best regards,</strong><br>The Workers United Team</p>
    `
    }),

    docs_reminder: (name) => ({
        subject: '⏰ Reminder: Complete Your Document Submission',
        body: `
      <h1>Hi ${name}!</h1>
      <p>We noticed you haven't uploaded your documents yet.</p>
      
      <p>Your profile was approved, but we're still waiting for your documents to proceed with finding you a job in Europe.</p>

      <p style="text-align: center; margin: 30px 0;">
        <a href="https://www.workersunited.eu/document-wizard.html?email={{EMAIL}}" 
           style="background-color: #2563eb; color: white; padding: 15px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
           📤 Complete Document Upload
        </a>
      </p>

      <p>Need help? Simply reply to this email.</p>

      <p style="margin-top: 40px;"><strong>Best regards,</strong><br>The Workers United Team</p>
    `
    }),

    payment_confirm: (name) => ({
        subject: '🎉 Welcome to the Priority Waitlist!',
        body: `
      <h1>Thank You, ${name}!</h1>
      <p>Your payment has been received and you are now on our Priority Waitlist!</p>
      
      <div class="info-box">
        <strong>🎯 What This Means:</strong><br>
        You are now actively being matched with employers across Europe. As soon as we find a suitable position, you'll be the first to know!
      </div>

      <h3>📊 Your Status</h3>
      <ul style="line-height: 2;">
        <li>✅ Profile: Approved</li>
        <li>✅ Documents: Verified</li>
        <li>✅ Payment: Confirmed</li>
        <li>🔄 Status: Matching with employers...</li>
      </ul>

      <p style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;">
        <strong>💰 90-Day Guarantee:</strong> If you don't receive a job offer within 90 days, you're entitled to a full refund.
      </p>

      <p style="margin-top: 40px;"><strong>Best regards,</strong><br>The Workers United Team</p>
    `
    })
};

export default async function handler(req, res) {
    // Security: Only allow from Vercel Cron or with secret key
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;

    if (authHeader !== `Bearer ${cronSecret}`) {
        // Also accept requests from Vercel Cron (they have specific headers)
        const isVercelCron = req.headers['x-vercel-cron'] === '1';
        if (!isVercelCron && cronSecret) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
    }

    try {
        const { sql } = await import('@vercel/postgres');
        const apiKey = process.env.BREVO_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ error: 'Missing BREVO_API_KEY' });
        }

        // Get pending emails that are due
        const pendingEmails = await sql`
      SELECT * FROM email_queue 
      WHERE sent = FALSE 
      AND send_at <= NOW()
      ORDER BY send_at ASC
      LIMIT 10
    `;

        const results = [];

        for (const emailJob of pendingEmails.rows) {
            try {
                const template = EMAIL_TEMPLATES[emailJob.email_type];

                if (!template) {
                    // Mark as error if template not found
                    await sql`
            UPDATE email_queue 
            SET sent = TRUE, error = 'Template not found'
            WHERE id = ${emailJob.id}
          `;
                    continue;
                }

                const { subject, body } = template(emailJob.candidate_name || 'Valued Candidate');
                const finalBody = body.replace(/{{EMAIL}}/g, encodeURIComponent(emailJob.candidate_email));

                // Send via Brevo
                const response = await fetch('https://api.brevo.com/v3/smtp/email', {
                    method: 'POST',
                    headers: {
                        'accept': 'application/json',
                        'api-key': apiKey,
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({
                        sender: { name: "Workers United", email: "contact@workersunited.eu" },
                        to: [{ email: emailJob.candidate_email, name: emailJob.candidate_name || '' }],
                        subject: subject,
                        htmlContent: getEmailTemplate(subject, finalBody)
                    })
                });

                if (response.ok) {
                    // Mark as sent
                    await sql`
            UPDATE email_queue 
            SET sent = TRUE, sent_at = NOW()
            WHERE id = ${emailJob.id}
          `;
                    results.push({ id: emailJob.id, status: 'sent' });
                } else {
                    const errorText = await response.text();
                    await sql`
            UPDATE email_queue 
            SET error = ${errorText}
            WHERE id = ${emailJob.id}
          `;
                    results.push({ id: emailJob.id, status: 'failed', error: errorText });
                }

            } catch (jobError) {
                await sql`
          UPDATE email_queue 
          SET error = ${jobError.message}
          WHERE id = ${emailJob.id}
        `;
                results.push({ id: emailJob.id, status: 'error', error: jobError.message });
            }
        }

        return res.status(200).json({
            processed: results.length,
            results
        });

    } catch (error) {
        console.error('Cron job error:', error);
        return res.status(500).json({ error: error.message });
    }
}
