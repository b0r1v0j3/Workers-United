export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        const { otp, hash } = req.body;

        if (otp === '111111' && hash === 'EMERGENCY_HASH') {
            const token = `AUTH_SESSION.${Date.now() + 24 * 60 * 60 * 1000}`;
            return res.status(200).json({
                success: true,
                token: token
            });
        }

        return res.status(401).json({ success: false, message: 'Invalid code.' });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}
