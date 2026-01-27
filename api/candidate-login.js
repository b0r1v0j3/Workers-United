export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email required' });

    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) return res.status(500).json({ message: 'Server Config Error' });

    try {
        // Search contact by email in Brevo
        const response = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
            method: 'GET',
            headers: {
                'accept': 'application/json',
                'api-key': apiKey
            }
        });

        if (response.status === 404) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!response.ok) {
            throw new Error('Brevo API error');
        }

        // We don't return the full data here for security (just success)
        // In a real app we would issue a JWT token here.
        // For "Zero Employee" V1 (Low Friction), we trust the email existence.

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('Login Error:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
}
