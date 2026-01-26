// Quick test endpoint to check Brevo API status
export default async function handler(req) {
    const apiKey = process.env.BREVO_API_KEY;

    if (!apiKey) {
        return new Response(JSON.stringify({
            error: 'Missing BREVO_API_KEY',
            hasKey: false
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        // Test Brevo API connection
        const res = await fetch('https://api.brevo.com/v3/contacts?limit=5&sort=desc', {
            method: 'GET',
            headers: {
                'accept': 'application/json',
                'api-key': apiKey
            }
        });

        const data = await res.json();

        return new Response(JSON.stringify({
            status: res.status,
            ok: res.ok,
            hasKey: true,
            contactCount: data.contacts ? data.contacts.length : 0,
            totalContacts: data.count || 0,
            contacts: data.contacts || [],
            error: res.ok ? null : data
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return new Response(JSON.stringify({
            error: error.message,
            hasKey: true,
            apiError: true
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
