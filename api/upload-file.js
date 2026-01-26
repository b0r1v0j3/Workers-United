import { put } from '@vercel/blob';

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).send('Method not allowed');
    }

    const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
    const filename = searchParams.get('filename');
    const type = searchParams.get('type');
    const email = searchParams.get('email');

    if (!filename || !email) {
        return res.status(400).send('Missing filename or email');
    }

    const path = `candidates/${email}/${type}-${Date.now()}-${filename}`;

    try {
        // Note: req is a readable stream in Node.js, Vercel blob put supports it.
        const blob = await put(path, req, {
            access: 'public',
            token: process.env.BLOB_READ_WRITE_TOKEN,
        });

        return res.status(200).json(blob);
    } catch (error) {
        console.error('Upload Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
