import { put } from '@vercel/blob';
import { getEmailTemplate } from './email-template.js';

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).send('Method not allowed');
    }

    const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
    const filename = searchParams.get('filename');
    const type = searchParams.get('type');
    const email = searchParams.get('email');

    if (!filename || !email) {
        return res.status(400).send('Missing filename or email');
    }

    const path = `candidates/${email}/${type}-${Date.now()}-${filename}`;

    try {
        // Note: req is a readable stream in Node.js, Vercel blob put supports it.
        const blob = await put(path, req, {
            access: 'public',
            token: process.env.BLOB_READ_WRITE_TOKEN,
        });

        // --- EMAIL NOTIFICATION START ---
        const apiKey = process.env.BREVO_API_KEY;
        if (apiKey) {
            const emailContent = `
                <h2>New Document Uploaded</h2>
                <p><strong>User Email:</strong> ${email}</p>
                <p><strong>Document Type:</strong> ${type || 'N/A'}</p>
                <p><strong>Filename:</strong> ${filename}</p>
                <p><strong>Download Link:</strong> <a href="${blob.url}" style="color:#2563eb;">${blob.url}</a></p>
                <hr/>
                <p>Time: ${new Date().toLocaleString('sr-RS', { timeZone: 'Europe/Belgrade' })}</p>
            `;

            const notificationPayload = {
                sender: { name: "Workers United System", email: "contact@workersunited.eu" },
                to: [{ email: "contact@workersunited.eu", name: "Workers United Admin" }],
                cc: [{ email: "cvetkovicborivoje@gmail.com", name: "Borivoje" }],
                subject: `[New Doc] ${filename} from ${email}`,
                htmlContent: getEmailTemplate('New Document Uploaded', emailContent)
            };

            try {
                // We await this to ensure it sends, but catch error so upload doesn't fail
                await fetch('https://api.brevo.com/v3/smtp/email', {
                    method: 'POST',
                    headers: {
                        'accept': 'application/json',
                        'api-key': apiKey,
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify(notificationPayload)
                });
                console.log('Notification email sent for', filename);

                // --- NEW: UPDATE CONTACT ATTRIBUTE ---
                try {
                    await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
                        method: 'PUT',
                        headers: {
                            'accept': 'application/json',
                            'api-key': apiKey,
                            'content-type': 'application/json'
                        },
                        body: JSON.stringify({
                            attributes: {
                                HAS_DOCUMENTS: true,
                                LEAD_STATUS: 'DOCS RECEIVED'
                            }
                        })
                    });
                    console.log('Updated HAS_DOCUMENTS and LEAD_STATUS for', email);
                } catch (attrErr) {
                    console.error('Failed to update contact attribute:', attrErr);
                }
                // --- END NEW ---

            } catch (emailErr) {
                console.error('Failed to send notification email:', emailErr);
            }
        }
        // --- EMAIL NOTIFICATION END ---

        return res.status(200).json(blob);
    } catch (error) {
        console.error('Upload Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
