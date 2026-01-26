import { getEmailTemplate } from './email-template.js';

export const config = {
    runtime: 'edge',
};

// Simple HMAC SHA-256 implementation using Web Crypto API
async function hmacSha256(key, data) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(key);
    const msgData = encoder.encode(data);

    const cryptoKey = await crypto.subtle.importKey(
        'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);

    // Convert ArrayBuffer to Hex string
    return [...new Uint8Array(signature)]
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

export default async function handler(req) {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ message: 'Method Not Allowed' }), { status: 405 });
    }

    try {
        const { password } = await req.json();

        // 1. Validate Password
        if (password !== 'Borivoje19.10.1992.') {
            return new Response(JSON.stringify({ success: false, message: 'Invalid password' }), { status: 401 });
        }

        // 2. Generate Random 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = Date.now() + 5 * 60 * 1000; // 5 minutes from now

        // 3. Create HMAC Hash (Challenge)
        // We use the BREVO_API_KEY as the secret key since it's secret and available
        const secretKey = process.env.BREVO_API_KEY || 'default-secret-key-change-me';
        const signature = await hmacSha256(secretKey, otp + expiry.toString());

        // 4. Send OTP via Email (Brevo)
        const apiKey = process.env.BREVO_API_KEY;

        if (apiKey) {
            const subject = `Your Login Code: ${otp}`;
            const bodyContent = `
                <p>Hello Admin,</p>
                <p>We received a request to access the Workers United Dashboard.</p>
                <div style="text-align: center; margin: 30px 0;">
                    <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #2563eb; background: #eff6ff; padding: 10px 20px; border-radius: 8px;">${otp}</span>
                </div>
                <p>This code is valid for <strong>5 minutes</strong>.</p>
                <p>If you did not request this code, please ignore this email.</p>
            `;

            await fetch('https://api.brevo.com/v3/smtp/email', {
                method: 'POST',
                headers: {
                    'accept': 'application/json',
                    'api-key': apiKey,
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    sender: { name: "Workers United Admin", email: "contact@workersunited.eu" },
                    to: [{ email: "cvetkovicborivoje@gmail.com", name: "Admin" }],
                    subject: subject,
                    htmlContent: getEmailTemplate('Secure Login Verification', bodyContent)
                })
            });
        } else {
            console.warn("No BREVO_API_KEY found, OTP not sent.");
        }

        // 5. Return Hash and Expiry to Client
        return new Response(JSON.stringify({
            success: true,
            challenge: {
                hash: signature,
                expiry: expiry
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Auth Init Error:', error);
        return new Response(JSON.stringify({ success: false, message: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
