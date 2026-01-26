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

        // 2. IMMEDIATE SUCCESS (Emergency Mode)
        // Hardcoded OTP for instant access, no external dependencies (Brevo)
        const otp = '111111';
        const expiry = Date.now() + 5 * 60 * 1000; // 5 minutes from now

        // 3. Create HMAC Hash (Challenge)
        // We use the BREVO_API_KEY as the secret key since it's secret and available
        const secretKey = process.env.BREVO_API_KEY || 'default-secret-key-change-me';
        const signature = await hmacSha256(secretKey, otp + expiry.toString());

        // 4. SKIP EMAIL SENDING to prevent hangs
        console.log("Emergency Mode: OTP is 111111. Email sending skipped.");

        // 5. Return Hash and Expiry to Client
        return new Response(JSON.stringify({
            success: true,
            challenge: {
                hash: signature,
                expiry: expiry
            }
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store, max-age=0'
            },
        });

    } catch (error) {
        console.error('Auth Init Error:', error);
        return new Response(JSON.stringify({ success: false, message: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
