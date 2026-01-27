
export default async function handler(req, res) {
    const apiKey = process.env.BREVO_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: 'Missing BREVO_API_KEY' });
    }

    try {
        const response = await fetch('https://api.brevo.com/v3/contacts/attributes/normal/HAS_DOCUMENTS', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': apiKey,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                type: 'boolean'
            })
        });

        if (response.ok) {
            return res.status(200).json({ message: 'HAS_DOCUMENTS attribute created successfully' });
        } else {
            const data = await response.json();
            if (data.code === 'duplicate_parameter') {
                return res.status(200).json({ message: 'Attribute HAS_DOCUMENTS already exists' });
            } else {
                return res.status(400).json({ error: data });
            }
        }

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
