import { list } from '@vercel/blob';

// Node.js runtime
// export const config = { runtime: 'edge' };

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
    if (req.method !== 'GET') {
        return new Response(JSON.stringify({ message: 'Method Not Allowed' }), { status: 405 });
    }

    try {
        // Security Check: Verify Session Token
        const authHeader = req.headers.get('Authorization');
        const token = authHeader?.replace('Bearer ', '') || req.headers.get('x-auth-token');
        const isValid = await verifyToken(token);

        if (!isValid) {
            return new Response(JSON.stringify({ message: 'Unauthorized: Invalid or expired session' }), { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const email = searchParams.get('email');

        if (!email) {
            return new Response(JSON.stringify({ message: 'Missing email' }), { status: 400 });
        }

        const { blobs } = await list({ permission: "public", prefix: `candidates/${email}/` });

        return new Response(JSON.stringify({ files: blobs }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
