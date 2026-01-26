export const config = {
    runtime: 'edge',
};

// HELPER: HMAC SHA-256
async function hmacSha256(key, data) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(key);
    const msgData = encoder.encode(data);
    const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
    return [...new Uint8Array(signature)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export default async function handler(req) {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ message: 'Method Not Allowed' }), { status: 405 });
    }

    try {
        const { otp, hash, expiry } = await req.json();

        // 1. Check Expiry
        if (Date.now() > expiry) {
            return new Response(JSON.stringify({ success: false, message: 'Code expired. Please login again.' }), { status: 401 });
        }

        // 2. Verify OTP Signature
        const secretKey = process.env.BREVO_API_KEY || 'default-secret-key-change-me';
        const expectedHash = await hmacSha256(secretKey, otp + expiry.toString());

        if (hash !== expectedHash) {
            return new Response(JSON.stringify({ success: false, message: 'Invalid code.' }), { status: 401 });
        }

        // 3. Generate Session Token
        // Token = expiry_timestamp . signature
        // Session valid for 24 hours
        const sessionExpiry = Date.now() + 24 * 60 * 60 * 1000;
        const sessionSignature = await hmacSha256(secretKey, "AUTH_SESSION" + sessionExpiry.toString());
        const token = `${sessionExpiry}.${sessionSignature}`;

        return new Response(JSON.stringify({
            success: true,
            token: token
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Auth Verify Error:', error);
        return new Response(JSON.stringify({ success: false, message: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
