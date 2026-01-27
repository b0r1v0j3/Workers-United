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
        // 1. Search contact by email
        // Brevo API: GET /contacts/{email}
        const brevoRes = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
            method: 'GET',
            headers: {
                'accept': 'application/json',
                'api-key': apiKey
            }
        });

        if (brevoRes.status === 404) {
            return res.status(200).json({ found: false });
        }

        if (!brevoRes.ok) {
            throw new Error('Brevo API Error');
        }

        const data = await brevoRes.json();
        const attrs = data.attributes || {};
        const status = attrs.LEAD_STATUS || 'NEW';
        const hasDocs = attrs.HAS_DOCUMENTS === true;

        let userMessage = '';
        if (status === 'NEW') userMessage = "We have received your application. It is currently in the initial review queue.";
        else if (status === 'DOCS REQUESTED') userMessage = "We are waiting for your documents. Please use the 'Upload Documents' option in this chat.";
        else if (status === 'DOCS_RECEIVED') userMessage = "We have received your documents and they are under review.";
        else if (status === 'UNDER REVIEW') userMessage = "Your profile is under detailed review by our team.";
        else if (status === 'APPROVED' || status === 'PAYMENT REQUESTED') userMessage = "Great news! Your application is approved and moving to the next stage.";
        else if (status === 'REJECTED') userMessage = "Unfortunately, we cannot proceed with your application at this time.";
        else userMessage = "Your application is in our system.";

        return res.status(200).json({
            found: true,
            status: status,
            hasDocs: hasDocs,
            message: userMessage
        });

    } catch (error) {
        console.error('Chat Status Error:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
}
