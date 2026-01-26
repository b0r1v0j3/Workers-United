import { list } from '@vercel/blob';

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'x-auth-token, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        // Security Check: Verify Session Token (Simple Emergency Check)
        const authHeader = req.headers['authorization'];
        const token = (authHeader?.replace('Bearer ', '') || req.headers['x-auth-token']);

        if (!token || !token.startsWith('AUTH_SESSION')) {
            // For get-docs, we might need to be lax or strict.
            // If we are in emergency mode, let's just check formatting.
            return res.status(401).json({ message: 'Unauthorized: Invalid session' });
        }

        const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
        const email = searchParams.get('email');

        if (!email) {
            return res.status(400).json({ message: 'Missing email' });
        }

        const { blobs } = await list({ permission: "public", prefix: `candidates/${email}/` });

        return res.status(200).json({ files: blobs });
    } catch (error) {
        console.error('Get Docs Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
