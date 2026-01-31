import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
    try {
        // Check Auth Token (Header)
        const token = request.headers.get('x-auth-token');
        // For now we trust the token (mock), later we verify JWT

        // Fetch Data
        const candidatesRes = await query('SELECT * FROM candidates ORDER BY created_at DESC');
        const documentsRes = await query('SELECT * FROM documents');

        // Merge Data
        const docsMap: Record<string, string[]> = {};
        documentsRes.rows.forEach((doc) => {
            if (!docsMap[doc.candidate_id]) docsMap[doc.candidate_id] = [];
            docsMap[doc.candidate_id].push(doc.file_type);
        });

        const leads = candidatesRes.rows.map((c) => ({
            id: c.id,
            email: c.email || '',
            name: c.name || c.email.split('@')[0],
            phone: c.phone || '',
            country: c.country || '-',
            role: c.role || '-',
            status: c.status ? c.status.toUpperCase() : 'NEW',
            has_documents: !!docsMap[c.id],
            doc_types: (docsMap[c.id] || []).join(', '),
        }));

        return NextResponse.json({ leads });
    } catch (error: any) {
        console.error('List Candidates Error:', error);
        return NextResponse.json(
            { error: 'Database Error', details: error.message },
            { status: 500 }
        );
    }
}
