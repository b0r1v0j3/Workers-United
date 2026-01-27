import { getEmailTemplate } from './email-template.js';

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

    const { name, email, message, type } = req.body;

    if (!email || !message) {
        return res.status(400).json({ message: 'Email and message are required' });
    }

    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) return res.status(500).json({ message: 'Server Config Error' });

    try {
        const emailContent = `
            <h2>New Chat Message</h2>
            <p><strong>From:</strong> ${name || 'Anonymous'}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Type:</strong> ${type || 'General Error'}</p>
            <hr/>
            <h3>Message:</h3>
            <p style="background:#f3f4f6; padding:10px; border-radius:4px;">${message}</p>
        `;

        const payload = {
            sender: { name: "Workers United Chat", email: "contact@workersunited.eu" },
            to: [{ email: "contact@workersunited.eu", name: "Workers United Team" }],
            cc: [{ email: "cvetkovicborivoje@gmail.com", name: "Borivoje" }],
            subject: `[Chat] New message from ${name || email}`,
            htmlContent: getEmailTemplate('New Chat Message', emailContent)
        };

        const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': apiKey,
                'content-type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!brevoRes.ok) {
            const err = await brevoRes.text();
            console.error('Brevo Error:', err);
            throw new Error('Failed to send email');
        }

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('Chat API Error:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
}
