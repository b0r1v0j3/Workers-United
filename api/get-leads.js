export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-auth-token'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        const token = req.headers['x-auth-token'];
        if (!token) {
            return res.status(401).json({ message: 'Unauthorized: Missing session' });
        }
        // In emergency mode, just check if token exists and starts with AUTH_SESSION
        if (!token.startsWith('AUTH_SESSION')) {
            return res.status(401).json({ message: 'Unauthorized: Invalid session' });
        }

        const apiKey = process.env.BREVO_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ message: 'Server configuration error: Missing API Key' });
        }

        // Fetch contacts from Brevo
        const fetchRes = await fetch('https://api.brevo.com/v3/contacts?limit=50&sort=desc', {
            method: 'GET',
            headers: {
                'accept': 'application/json',
                'api-key': apiKey
            }
        });

        if (!fetchRes.ok) {
            const errorText = await fetchRes.text();
            console.error('Brevo API Error:', errorText);
            throw new Error('Failed to fetch contacts from Brevo');
        }

        const data = await fetchRes.json();
        const contacts = data.contacts || [];

        const leads = contacts.map(c => {
            const attrs = c.attributes || {};
            // Helper to find attribute case-insensitively
            const getAttr = (key) => attrs[key] || attrs[key.toUpperCase()] || attrs[key.charAt(0).toUpperCase() + key.slice(1).toLowerCase()];

            return {
                id: c.id,
                email: c.email,
                name: `${attrs.FIRSTNAME || ''} ${attrs.LASTNAME || ''}`.trim(),
                phone: getAttr('PHONE') || '',
                country: getAttr('COUNTRY') || 'Unknown',
                role: getAttr('ROLE') || 'Unknown',
                job_preference: getAttr('JOB_PREFERENCE') || '-',
                has_documents: getAttr('HAS_DOCUMENTS') === true,
                status: getAttr('LEAD_STATUS') || 'NEW',
                date: c.createdAt
            };
        });

        return res.status(200).json({ leads });

    } catch (error) {
        console.error('Get Leads Error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
}
