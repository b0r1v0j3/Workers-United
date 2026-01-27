
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
    // 1. CORS Headers (Permissive for Admin Panel)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-auth-token');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        console.log('Fetching candidates...');

        // 2. Fetch Data (Two simple queries)
        const candidatesRes = await sql`SELECT * FROM candidates ORDER BY created_at DESC`;
        const documentsRes = await sql`SELECT * FROM documents`;

        console.log(`Fetched ${candidatesRes.rowCount} candidates and ${documentsRes.rowCount} documents.`);

        // 3. Merge Data (JS Logic)
        const docsMap = {};
        documentsRes.rows.forEach(doc => {
            if (!docsMap[doc.candidate_id]) docsMap[doc.candidate_id] = [];
            docsMap[doc.candidate_id].push(doc.file_type);
        });

        const leads = candidatesRes.rows.map(c => ({
            id: c.id,
            email: c.email || '',
            name: c.name || c.email.split('@')[0],
            phone: c.phone || '',
            country: c.country || '-',
            role: c.role || '-',
            status: c.status ? c.status.toUpperCase() : 'NEW',
            has_documents: !!docsMap[c.id],
            doc_types: (docsMap[c.id] || []).join(', ')
        }));

        // 4. Return JSON
        return res.status(200).json({ leads });

    } catch (error) {
        console.error('List Candidates Error:', error);
        return res.status(500).json({
            error: 'Database Error',
            details: error.message
        });
    }
}
