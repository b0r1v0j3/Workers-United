
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
    try {
        const countRes = await sql`SELECT COUNT(*) FROM candidates`;
        const sampleRes = await sql`SELECT * FROM candidates LIMIT 5`;
        const docsRes = await sql`SELECT COUNT(*) FROM documents`;

        return res.status(200).json({
            candidate_count: countRes.rows[0].count,
            document_count: docsRes.rows[0].count,
            sample_candidates: sampleRes.rows
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
