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
        // 2. Fetch Candidates
        // Group by ALL non-aggregated columns to ensure SQL compatibility
        const { rows } = await sql`
            SELECT
                c.id, c.email, c.name, c.phone, c.country, c.role, c.status, c.created_at,
                STRING_AGG(d.file_type, ', ') as doc_types,
                COUNT(d.id) > 0 as has_documents
            FROM candidates c
            LEFT JOIN documents d ON c.id = d.candidate_id
            GROUP BY c.id, c.email, c.name, c.phone, c.country, c.role, c.status, c.created_at
            ORDER BY c.created_at DESC;
        `;

        // 3. Map to format expected by Admin Panel
        const leads = rows.map(row => ({
            id: row.id,
            email: row.email,
            name: row.name || row.email.split('@')[0],
            phone: row.phone || '',
            country: row.country || '-',
            role: row.role || '-',
            // Ensure status matches frontend expectation (uppercase)
            status: row.status ? row.status.toUpperCase() : 'NEW',
            has_documents: row.has_documents, // Boolean from SQL
            doc_types: row.doc_types || '' // "Passport, CV"
        }));

        return res.status(200).json({ leads });

    } catch (error) {
        console.error('Database Error:', error);
        return res.status(500).json({ error: 'Failed to fetch leads from Database' });
    }
}
