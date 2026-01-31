import { sql } from '@vercel/postgres';

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

    try {
        // Check if candidate exists in Postgres
        const result = await sql`
            SELECT id, email, name FROM candidates 
            WHERE LOWER(email) = LOWER(${email})
        `;

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        // In production, generate and send OTP here
        // For now, just confirm email exists
        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('Login Error:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
}
