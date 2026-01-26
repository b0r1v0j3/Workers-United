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
    if (req.method !== 'GET') {
        return new Response(JSON.stringify({ message: 'Method Not Allowed' }), { status: 405 });
    }

    try {
        // Security Check: Verify Session Token
        const token = req.headers.get('x-auth-token');
        const isValid = await verifyToken(token);

        if (!isValid) {
            return new Response(JSON.stringify({ message: 'Unauthorized: Invalid or expired session' }), { status: 401 });
        }

        const apiKey = process.env.BREVO_API_KEY;
        if (!apiKey) {
            return new Response(JSON.stringify({ message: 'Server configuration error' }), { status: 500 });
        }

        // Fetch contacts from Brevo
        const res = await fetch('https://api.brevo.com/v3/contacts?limit=50&sort=desc', {
            method: 'GET',
            headers: {
                'accept': 'application/json',
                'api-key': apiKey
            }
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error('Brevo API Error:', errorText);
            throw new Error('Failed to fetch contacts from Brevo');
        }

        const data = await res.json();
        const contacts = data.contacts || [];

        // Map to a cleaner format
        const leads = contacts.map(c => {
            const attrs = c.attributes || {};
            return {
                id: c.id,
                email: c.email,
                name: `${attrs.FIRSTNAME || ''} ${attrs.LASTNAME || ''}`.trim(),
                country: attrs.COUNTRY || 'Unknown',
                role: attrs.ROLE || 'Unknown',
                status: attrs.LEAD_STATUS || 'NEW',
                date: c.createdAt
            };
        });

        return new Response(JSON.stringify({ leads }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store, max-age=0'
            },
        });

    } catch (error) {
        console.error('Get Leads Error:', error);
        return new Response(JSON.stringify({ success: false, message: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
