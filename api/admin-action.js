import { getEmailTemplate } from './email-template.js';
import { list, del } from '@vercel/blob';

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
                subject = 'Next Steps with Workers United';
                statusLabel = 'DOCS REQUESTED';
                bodyContent = `
          <p>Dear ${name},</p>
          <p>Thank you for your patience.</p>
          <p>We are pleased to inform you that your profile has passed our initial screening.</p>
          <p class="info-box">Before we can proceed to the next stage of your application, we require verification of your documents.</p>
            <p><strong>Please upload your documents securely via the link below:</strong></p>
            <p style="text-align: center; margin: 20px 0;">
                <a href="https://www.workersunited.eu/upload?email=${encodeURIComponent(email)}" 
                   style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                   Upload Documents Check
                </a>
            </p>
            <p><strong>Required Documents:</strong></p>
            <ul>
                <li><strong>Passport Copy</strong> (Photo Page)</li>
                <li><strong>Proof of Education</strong> (Diploma or Certificate)</li>
                <li>Current <strong>Residence Permit</strong> (if applicable)</li>
                <li>Updated <strong>CV</strong> (Resume)</li>
            </ul>
        `;
                break;

            case 'docs_received':
                subject = 'Documents Received - Under Review';
                statusLabel = 'UNDER REVIEW';
                bodyContent = `
          <p>Dear ${name},</p>
          <p><strong>We confirm that we have received your documents.</strong></p>
          <p>Our legal team has started the review process.</p>
          <p class="info-box">Please allow <strong>24-48 hours</strong> for this assessment. We will contact you immediately once the review is complete with the next steps.</p>
          <p>You do not need to take any further action at this moment.</p>
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
                subject = 'IMPORTANT: Eligibility Confirmed - Next Steps';
                statusLabel = 'PAYMENT REQUESTED';
                bodyContent = `
          <p>Dear ${name},</p>
          <p><strong>Good news!</strong> After reviewing your documents, our legal team has confirmed your eligibility for the work visa program.</p>
          <p>We are ready to begin the official process.</p>
          <p class="info-box">We are currently preparing your service agreement and invoice. You will receive a separate email with payment instructions and the contract within 24 hours.</p>
          <p>Welcome to Workers United!</p>
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
                    // Don't fail the whole request, just log it
                }

                // 2. Delete from Brevo
                const deleteRes = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
                    method: 'DELETE',
                    headers: { 'accept': 'application/json', 'api-key': apiKey }
                });

                if (!deleteRes.ok && deleteRes.status !== 404) {
                    return res.status(400).json({ success: false, message: 'Failed to delete from Brevo' });
                }
                return res.status(200).json({ success: true, message: `Contact deleted successfully.` });

            default:
                return res.status(400).json({ success: false, message: 'Invalid action' });
        }

        const htmlContent = getEmailTemplate(subject, bodyContent);

        // 1. Update Lead Status
        await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
            method: 'PUT',
            headers: { 'accept': 'application/json', 'api-key': apiKey, 'content-type': 'application/json' },
            body: JSON.stringify({ attributes: { LEAD_STATUS: statusLabel } })
        });

        // 2. Send Email
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
