import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ message: 'Method Not Allowed' });

    const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
    const email = searchParams.get('email');

    if (!email) return res.status(400).json({ message: 'Email required' });

    try {
        // Fetch candidate data from Postgres
        const candidateRes = await sql`
            SELECT id, email, name, phone, country, role, status 
            FROM candidates 
            WHERE LOWER(email) = LOWER(${email})
        `;

        if (candidateRes.rows.length === 0) {
            return res.status(404).json({ message: 'Not found' });
        }

        const c = candidateRes.rows[0];

        // Check if candidate has documents
        const docsRes = await sql`
            SELECT COUNT(*) as count FROM documents WHERE candidate_id = ${c.id}
        `;
        const hasDocuments = parseInt(docsRes.rows[0].count) > 0;

        const candidate = {
            name: c.name || 'Candidate',
            status: c.status || 'NEW',
            hasDocs: hasDocuments,
            jobPreference: c.role || 'General',
            country: c.country || 'Unknown'
        };

        return res.status(200).json({ candidate });

    } catch (error) {
        console.error('Data Fetch Error:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
}
