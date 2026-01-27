import { getEmailTemplate } from './email-template.js';
import { list, del } from '@vercel/blob';
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-auth-token');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        const { action, email, id, name } = req.body;
        // Skip sophisticated token check for emergency

        const apiKey = process.env.BREVO_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ message: 'Server configuration error' });
        }

        let subject = '';
        let bodyContent = '';
        let statusLabel = '';

        // Define Email Templates based on Action
        switch (action) {
            case 'request_docs':
                subject = '🎯 Great News! Your Profile Has Been Approved - Next Steps';
                statusLabel = 'DOCS REQUESTED';
                bodyContent = `
          <h1>🎉 Congratulations, ${name}!</h1>
          <p>Dear ${name},</p>
          
          <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 25px 0;">
              <strong>✅ Your Profile Has Been Approved!</strong><br>
              After reviewing your application, we are pleased to inform you that you have passed our initial screening and qualify for our work visa program.
          </div>

          <h3>📋 Next Step: Document Verification</h3>
          <p>To move forward with your application, we need to verify your documents. This is a standard requirement for all legal work visa processes.</p>

          <p style="text-align: center; margin: 30px 0;">
              <a href="https://www.workersunited.eu/upload?email=${encodeURIComponent(email)}" 
                 style="background-color: #10b981; color: white; padding: 15px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">
                 📤 Upload Your Documents Now
              </a>
          </p>

          <h3>📄 Required Documents:</h3>
          <ul style="line-height: 2; font-size: 15px;">
              <li>✅ <strong>Passport Copy</strong> – Clear scan/photo of the photo page</li>
              <li>✅ <strong>Educational Certificates</strong> – Diploma, degree, or relevant certifications</li>
              <li>✅ <strong>Updated CV/Resume</strong> – Include work experience and skills</li>
              <li>✅ <strong>Residence Permit</strong> (if currently living outside your home country)</li>
          </ul>

          <div class="info-box">
              <strong>⏱️ Processing Time:</strong><br>
              Once we receive your documents, our legal team will review them within 24-48 hours. We will notify you immediately once the review is complete.
          </div>

          <h3>🔒 Your Privacy & Security</h3>
          <p>All documents are encrypted and stored securely. We comply with GDPR and EU data protection regulations. Your information will only be used for visa processing purposes.</p>

          <p style="margin-top: 30px;">If you have any questions about which documents to upload, feel free to reply to this email.</p>
          
          <p><strong>We look forward to helping you achieve your career goals!</strong></p>
          
          <p style="margin-top: 30px;"><strong>Best regards,</strong><br>Workers United Legal Team</p>
        `;
                break;

            case 'docs_received':
                subject = '✅ Documents Received – Review in Progress';
                statusLabel = 'UNDER REVIEW';
                bodyContent = `
          <h1>📬 Documents Successfully Received!</h1>
          <p>Dear ${name},</p>
          
          <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 20px; margin: 25px 0;">
              <strong>✅ Your Documents Are Now Under Review</strong><br>
              We have successfully received all your documents. Our legal team is currently examining them to ensure everything meets the requirements for the work visa application.
          </div>

          <h3>⏱️ What Happens Now?</h3>
          <ol style="line-height: 2;">
              <li><strong>Legal Review</strong> – Our experienced team verifies authenticity and compliance (24-48 hours)</li>
              <li><strong>Eligibility Assessment</strong> – We match your qualifications with employer requirements</li>
              <li><strong>Next Steps Notification</strong> – You'll receive an email with the outcome and further instructions</li>
          </ol>

          <div class="info-box">
              <strong>⏰ Expected Response Time:</strong><br>
              You will hear from us within <strong>24-48 hours</strong>. No action is required from you at this time.
          </div>

          <h3>📞 Need Help?</h3>
          <p>If you have any questions or need to update any information, simply reply to this email or contact us at <strong>contact@workersunited.eu</strong>.</p>

          <p style="margin-top: 30px;"><strong>Thank you for your patience!</strong></p>
          
          <p style="margin-top: 20px;"><strong>Best regards,</strong><br>Workers United Legal Team</p>
        `;
                break;

            case 'reject':
                subject = 'Update on your Application - Workers United';
                statusLabel = 'REJECTED';
                bodyContent = `
          <p>Dear ${name},</p>
          <p>After a careful review of your application and documents, we regret to inform you that we cannot proceed with your case at this time.</p>
        `;
                break;

            case 'approve_payment':
                subject = '🎊 APPROVED! Your Work Visa Process Begins – Service Agreement Inside';
                statusLabel = 'PAYMENT REQUESTED';
                bodyContent = `
          <h1>🎉 Congratulations, ${name}!</h1>
          <p>Dear ${name},</p>
          
          <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 25px; margin: 25px 0; font-size: 16px;">
              <strong>✅ GREAT NEWS – YOU HAVE BEEN APPROVED!</strong><br><br>
              After a thorough review of your documents and qualifications, our legal team has confirmed that you are <strong>eligible for the work visa program</strong> in Europe.
          </div>

          <h3>🚀 What Happens Next?</h3>
          <p>We are now ready to officially begin your work visa process. Here's what you can expect:</p>
          
          <ol style="line-height: 2.2; font-size: 15px;">
              <li><strong>Service Agreement & Invoice</strong> – You will receive a detailed contract and payment information within the next 24 hours</li>
              <li><strong>Employer Matching</strong> – We will connect you with verified employers looking for candidates with your qualifications</li>
              <li><strong>Visa Application Support</strong> – Our legal team will handle all paperwork and guide you through every step</li>
              <li><strong>Pre-Departure Assistance</strong> – Travel arrangements, accommodation guidance, and orientation</li>
          </ol>

          <h3>💰 Transparent Pricing</h3>
          <p>Our service fee covers:</p>
          <ul style="line-height: 1.8;">
              <li>✅ Legal consultation and document preparation</li>
              <li>✅ Work visa application processing</li>
              <li>✅ Employer verification and job placement</li>
              <li>✅ Employment contract review</li>
              <li>✅ Post-arrival support for 3 months</li>
          </ul>

          <div class="info-box">
              <strong>📧 Check Your Email</strong><br>
              You will receive a separate email within <strong>24 hours</strong> containing:
              <ul style="margin: 10px 0 0 20px;">
                  <li>Detailed service agreement</li>
                  <li>Invoice with payment options</li>
                  <li>Timeline for next steps</li>
              </ul>
          </div>

          <h3>🌍 Welcome to the Workers United Family!</h3>
          <p>You are one step closer to your career goals in Europe. Our team is committed to making this process as smooth and stress-free as possible.</p>

          <p>If you have any questions before receiving the official documents, please don't hesitate to contact us.</p>

          <p style="margin-top: 30px; font-size: 16px;"><strong>Congratulations again, and welcome aboard!</strong></p>
          
          <p style="margin-top: 20px;"><strong>Best regards,</strong><br>Workers United Team<br><em>Your partners in international career success</em></p>
        `;
                break;

            case 'delete':
                // 1. Delete files from Vercel Blob
                try {
                    const prefix = `candidates/${email}/`;
                    const { blobs } = await list({ prefix, token: process.env.BLOB_READ_WRITE_TOKEN });
                    if (blobs.length > 0) {
                        const urls = blobs.map(b => b.url);
                        await del(urls, { token: process.env.BLOB_READ_WRITE_TOKEN });
                        console.log(`Deleted ${urls.length} files for ${email}`);
                    }
                } catch (blobErr) {
                    console.error('Blob cleanup failed:', blobErr);
                }

                // 2. Delete from Postgres (CASCADE will delete documents and audit logs)
                await sql`DELETE FROM candidates WHERE LOWER(email) = LOWER(${email})`;

                // 3. Delete from Brevo (Legacy cleanup)
                const deleteRes = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
                    method: 'DELETE',
                    headers: { 'accept': 'application/json', 'api-key': apiKey }
                }).catch(err => console.log('Brevo delete failed (non-critical):', err.message));

                return res.status(200).json({ success: true, message: `Contact deleted successfully.` });

            default:
                return res.status(400).json({ success: false, message: 'Invalid action' });
        }

        const htmlContent = getEmailTemplate(subject, bodyContent);

        // 1. Update Status in POSTGRES
        await sql`
            UPDATE candidates 
            SET status = ${statusLabel}, updated_at = NOW() 
            WHERE LOWER(email) = LOWER(${email})
        `;

        // 2. Log Action in Audit Trail
        await sql`
            INSERT INTO audit_logs (candidate_id, action, performed_by, details)
            SELECT id, ${`STATUS_CHANGE_${action}`}, 'Admin', ${JSON.stringify({ previous_status: 'UNKNOWN', new_status: statusLabel })}::jsonb
            FROM candidates WHERE LOWER(email) = LOWER(${email})
        `;

        // 3. Update in Brevo (Legacy - for email compatibility)
        await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
            method: 'PUT',
            headers: { 'accept': 'application/json', 'api-key': apiKey, 'content-type': 'application/json' },
            body: JSON.stringify({ attributes: { LEAD_STATUS: statusLabel } })
        }).catch(err => console.log('Brevo update failed (non-critical):', err.message));

        // 4. Send Email
        const sendEmailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'accept': 'application/json', 'api-key': apiKey, 'content-type': 'application/json' },
            body: JSON.stringify({
                sender: { name: "Workers United LLC", email: "contact@workersunited.eu" },
                to: [{ email: email, name: name }],
                subject: subject,
                htmlContent: htmlContent
            })
        });

        if (!sendEmailRes.ok) throw new Error(`Failed to send email`);

        return res.status(200).json({ success: true, message: `Action ${action} executed successfully` });

    } catch (error) {
        console.error('Admin Action Error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
}
