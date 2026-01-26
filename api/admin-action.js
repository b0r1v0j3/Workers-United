import { getEmailTemplate } from './email-template.js';

export const config = {
    runtime: 'edge',
};

async function verifyToken(token) {
    if (!token) return false;
    const [expiryStr, signature] = token.split('.');
    if (!expiryStr || !signature) return false;

    if (Date.now() > parseInt(expiryStr)) return false;

    const secretKey = process.env.BREVO_API_KEY || 'default-secret-key-change-me';

    // Quick local HMAC helper
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secretKey);
    const msgData = encoder.encode("AUTH_SESSION" + expiryStr);
    const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sigBuf = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
    const expectedSig = [...new Uint8Array(sigBuf)].map(b => b.toString(16).padStart(2, '0')).join('');

    return signature === expectedSig;
}

export default async function handler(req) {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ message: 'Method Not Allowed' }), { status: 405 });
    }

    try {
        const { action, email, id, name, token } = await req.json();

        // Use ID if available, fallback to Email
        const identifier = id || email;

        // Security check
        const isValid = await verifyToken(token);
        if (!isValid) {
            return new Response(JSON.stringify({ success: false, message: 'Unauthorized: Invalid or expired session' }), { status: 401 });
        }

        const apiKey = process.env.BREVO_API_KEY;
        if (!apiKey) {
            return new Response(JSON.stringify({ message: 'Server configuration error' }), { status: 500 });
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
          <p><strong>Please reply to this email with the following documents:</strong></p>
          <ul>
            <li><strong>Passport Copy</strong> (Photo Page)</li>
            <li><strong>Proof of Education</strong> (Diploma or Certificate)</li>
            <li>Current <strong>Residence Permit</strong> (if applicable)</li>
            <li>Updated <strong>CV</strong> (Resume)</li>
          </ul>
          <p>Our legal team will review these documents to ensure eligibility for the work visa process.</p>
          <p>This review is complimentary.</p>
        `;
                break;

            case 'docs_received':
                subject = 'Documents Received - Under Review';
                statusLabel = 'UNDER REVIEW';
                bodyContent = `
          <p>Dear ${name},</p>
          <p>We confirm receipt of your documents.</p>
          <p>Our team is currently reviewing your file to assess eligibility.</p>
          <p class="info-box">We aim to complete all reviews within 48-72 hours.</p>
          <p>You do not need to take any further action at this time. We will contact you immediately once a decision has been made.</p>
        `;
                break;

            case 'reject':
                subject = 'Update on your Application - Workers United';
                statusLabel = 'REJECTED';
                bodyContent = `
          <p>Dear ${name},</p>
          <p>Thank you for your interest in Workers United.</p>
          <p>After a careful review of your application and documents, we regret to inform you that we cannot proceed with your case at this time.</p>
          <p>This decision is based on current strict visa regulations and employer requirements specific to your profile.</p>
          <p>We will keep your details in our database and contact you should more suitable opportunities arise in the future.</p>
          <p>We wish you the best in your professional endeavors.</p>
        `;
                break;

            case 'approve_payment':
                subject = 'IMPORTANT: Eligibility Confirmed - Next Steps';
                statusLabel = 'PAYMENT REQUESTED';
                bodyContent = `
          <p>Dear ${name},</p>
          <p><strong>Good news!</strong> After reviewing your documents, our legal team has confirmed your eligibility for the work visa program.</p>
          <p>We are ready to begin the official process.</p>
          <p class="info-box">To officially open your file and start coordination with the employer, a one-time processing fee is required.</p>
          <p>Please use the secure link below to complete the payment:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="#" class="btn">SECURE PAYMENT LINK (Coming Soon)</a>
          </div>
          <p>Once payment is confirmed, you will receive your official <strong>Service Agreement</strong> and we will submit your application to the relevant authorities immediately.</p>
        `;
            case 'delete':
                // No email template for delete, just API action
                const deleteRes = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(identifier)}`, {
                    method: 'DELETE',
                    headers: {
                        'accept': 'application/json',
                        'api-key': apiKey
                    }
                });

                if (!deleteRes.ok) {
                    // Check if 404 (already deleted) - we treat as success
                    if (deleteRes.status !== 404) {
                        const delErr = await deleteRes.text();
                        return new Response(JSON.stringify({
                            success: false,
                            message: `Failed to delete from Brevo: ${delErr}`
                        }), { status: 400 });
                    }
                }

                return new Response(JSON.stringify({
                    success: true,
                    message: `Contact ${email} deleted successfully.`
                }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });

                return new Response(JSON.stringify({ success: false, message: 'Invalid action' }), { status: 400 });
        }

        // Generate Full HTML
        const htmlContent = getEmailTemplate(subject, bodyContent);

        // 1. Update Lead Status in Brevo CRM
        const updateRes = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
            method: 'PUT',
            headers: {
                'accept': 'application/json',
                'api-key': apiKey,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                attributes: {
                    LEAD_STATUS: statusLabel
                }
            })
        });

        if (!updateRes.ok) {
            const updateErr = await updateRes.text();
            console.error('Brevo Update Error:', updateErr);
            return new Response(JSON.stringify({
                success: false,
                message: `Failed to update status. check if LEAD_STATUS attribute exists in Brevo. Error: ${updateRes.status}`
            }), { status: 400 });
        }

        // 2. Send the Email
        const sendEmailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': apiKey,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                sender: { name: "Workers United LLC", email: "contact@workersunited.eu" },
                to: [{ email: email, name: name }],
                subject: subject,
                htmlContent: htmlContent
            })
        });

        if (!sendEmailRes.ok) {
            const emailErr = await sendEmailRes.text();
            throw new Error(`Failed to send email: ${emailErr}`);
        }

        return new Response(JSON.stringify({ success: true, message: `Action ${action} executed successfully` }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Admin Action Error:', error);
        return new Response(JSON.stringify({ success: false, message: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
