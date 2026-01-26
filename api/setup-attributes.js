export default async function handler(req, res) {
    if (req.query.secret !== 'fix_my_crm') {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Missing API Key' });

    const attributes = [
        { name: 'COUNTRY', type: 'text' },
        { name: 'ROLE', type: 'text' },
        { name: 'JOB_PREFERENCE', type: 'text' },
        { name: 'LEAD_STATUS', type: 'text' }
    ];

    const results = [];

    for (const attr of attributes) {
        try {
            const response = await fetch(`https://api.brevo.com/v3/contacts/attributes/normal/${attr.name}`, {
                method: 'POST',
                headers: {
                    'accept': 'application/json',
                    'api-key': apiKey,
                    'content-type': 'application/json'
                },
                body: JSON.stringify({ type: attr.type })
            });

            if (response.ok) {
                results.push({ name: attr.name, status: 'Created' });
            } else {
                const err = await response.json();
                results.push({ name: attr.name, status: 'Error/Exists', details: err });
            }
        } catch (e) {
            results.push({ name: attr.name, status: 'Exception', error: e.message });
        }
    }

    return res.status(200).json({ results });
}
