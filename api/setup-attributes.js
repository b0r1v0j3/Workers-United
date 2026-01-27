
export default async function handler(req, res) {
    const apiKey = process.env.BREVO_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: 'Missing BREVO_API_KEY' });
    }

    const attributes = [
        { name: 'HAS_DOCUMENTS', type: 'boolean' },
        { name: 'DOC_TYPES', type: 'text' },
        { name: 'LEAD_STATUS', type: 'text' },
        { name: 'JOB_PREFERENCE', type: 'text' },
        { name: 'ROLE', type: 'text' },
        { name: 'COUNTRY', type: 'text' }
    ];

    try {
        const results = [];
        for (const attr of attributes) {
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
                results.push(`Created ${attr.name}`);
            } else {
                const data = await response.json();
                if (data.code === 'duplicate_parameter') {
                    results.push(`Exists ${attr.name}`);
                } else {
                    results.push(`Error ${attr.name}: ${JSON.stringify(data)}`);
                }
            }
        }
        return res.status(200).json({ results });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
