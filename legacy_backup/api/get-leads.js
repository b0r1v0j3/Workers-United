export default async function handler(req, res) {
    // 1. Setup Headers
    // Note: Credentials=true cannot be used with Origin=*.
    // Since we are same-origin, we can relax this, or reflect the origin.
    const origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-auth-token');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        // 2. Fetch Candidates and Documents Separately (Robust Method)
        const candidatesRes = await sql`SELECT * FROM candidates ORDER BY created_at DESC`;
        const documentsRes = await sql`SELECT * FROM documents`;

        const candidates = candidatesRes.rows;
        const documents = documentsRes.rows;

        // Group documents by candidate_id
        const docsMap = {};
        documents.forEach(doc => {
            if (!docsMap[doc.candidate_id]) docsMap[doc.candidate_id] = [];
            docsMap[doc.candidate_id].push(doc.file_type);
        });

        // 3. Map to format expected by Admin Panel
        const leads = candidates.map(row => ({
            id: row.id,
            email: row.email,
            name: row.name || row.email.split('@')[0],
            phone: row.phone || '',
            country: row.country || '-',
            role: row.role || '-',
            // Ensure status matches frontend expectation (uppercase)
            status: row.status ? row.status.toUpperCase() : 'NEW',
            has_documents: (docsMap[row.id] && docsMap[row.id].length > 0),
            doc_types: (docsMap[row.id] || []).join(', ')
        }));

        return res.status(200).json({ leads });

    } catch (error) {
        console.error('Database Error:', error);
        return res.status(500).json({ error: 'Failed to fetch leads from Database' });
    }
}
