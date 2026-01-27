export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ message: 'Method Not Allowed' });

    // In a real app, we would verify JWT token here.
    // For V1 "Email Access", we pass email as query param (secured by obscurity/low stakes).
    // TODO for V2: Implement proper Session/JWT.

    const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
    const email = searchParams.get('email');

    if (!email) return res.status(400).json({ message: 'Email required' });

    const apiKey = process.env.BREVO_API_KEY;
    try {
        const response = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
            method: 'GET',
            headers: {
                'accept': 'application/json',
                'api-key': apiKey
            }
        });

        if (response.status === 404) return res.status(404).json({ message: 'Not found' });
        if (!response.ok) throw new Error('Brevo API Error');

        const data = await response.json();
        const attrs = data.attributes || {};

        // Map Brevo Attributes to clean frontend object
        // NOTE: Ensure these attribute names match your Brevo CRM fields exactly
        const candidate = {
            name: attrs.FIRSTNAME || attrs.NAME || 'Candidate', // Adjust based on your Brevo setup
            status: attrs.LEAD_STATUS || 'NEW', // NEW, DOCS REQUESTED, UNDER REVIEW, APPROVED
            hasDocs: attrs.HAS_DOCUMENTS === true,
            jobPreference: attrs.JOB_PREFERENCE || 'General',
            country: attrs.COUNTRY || 'Unknown'
        };

        return res.status(200).json({ candidate });

    } catch (error) {
        console.error('Data Fetch Error:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
}
