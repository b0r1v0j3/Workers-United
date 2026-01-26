export const config = {
    runtime: 'edge',
};

export default async function handler(req) {
    if (req.method !== 'GET') {
        return new Response(JSON.stringify({ message: 'Method Not Allowed' }), { status: 405 });
    }

    try {
        const apiKey = process.env.BREVO_API_KEY;
        if (!apiKey) {
            return new Response(JSON.stringify({ message: 'Server configuration error' }), { status: 500 });
        }

        // Fetch contacts from Brevo
        // We filter by attributes used in our funnel if possible, or just get all and filter in frontend
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

        // Map to a cleaner format for our dashboard
        const leads = contacts.map(c => {
            const attrs = c.attributes || {};
            return {
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
                'Cache-Control': 'no-store, max-age=0' // Ensure fresh data
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
