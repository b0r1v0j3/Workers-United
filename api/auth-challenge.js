import { getEmailTemplate } from './email-template.js';

// Node.js runtime
// export const config = { runtime: 'edge' };

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

        // 2. Generate Emergency OTP
        const otp = '111111'; // HARDCODED EMERGENCY CODE
        const expiry = Date.now() + 5 * 60 * 1000; // 5 minutes from now

        // 3. Create HMAC Hash (Challenge)
        const secretKey = process.env.BREVO_API_KEY || 'default-secret-key-change-me';
        const signature = await hmacSha256(secretKey, otp + expiry.toString());

        // 4. Try to Send OTP via Email (Brevo) - Fire and Forget / Non-blocking
        const apiKey = process.env.BREVO_API_KEY;

        if (apiKey) {
            // We will try to send but NOT await it to block the response
            // Or await with a very short timeout and swallow error
            const emailPromise = (async () => {
                const subject = `Your Login Code: ${otp}`;
                const bodyContent = `
                    <p>Hello Admin,</p>
                    <p>Your Emergency Login Code is:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #d97706; background: #fffbeb; padding: 10px 20px; border-radius: 8px;">${otp}</span>
                    </div>
                `;
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout max

                try {
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
                        }),
                        signal: controller.signal
                    });
                } catch (e) {
                    console.error("Failed to send email (ignored for emergency login):", e);
                } finally {
                    clearTimeout(timeoutId);
                }
            })();

            // We don't await emailPromise fully to ensure fast response, 
            // but Vercel might kill it. For safety, we await it but catch errors.
            try { await emailPromise; } catch (e) { }
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
