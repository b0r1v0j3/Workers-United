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

        // 2. Return EMERGENCY CHALLENGE (No Crypto, No Email, Just JSON)
        return new Response(JSON.stringify({
            success: true,
            challenge: {
                hash: 'EMERGENCY_HASH',
                expiry: Date.now() + 5 * 60 * 1000
            }
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store, max-age=0'
            },
        });

    } catch (error) {
        return new Response(JSON.stringify({ success: false, message: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
