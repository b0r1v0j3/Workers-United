import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
        return NextResponse.json({ message: 'Email required' }, { status: 400 });
    }

    try {
        // Fetch candidate data from Postgres
        const candidateRes = await query(
            `SELECT id, email, name, phone, country, role, status 
       FROM candidates 
       WHERE LOWER(email) = LOWER($1)`,
            [email]
        );

        if (candidateRes.rows.length === 0) {
            return NextResponse.json({ message: 'Not found' }, { status: 404 });
        }

        const c = candidateRes.rows[0];

        // Check if candidate has documents
        const docsRes = await query(
            `SELECT COUNT(*) as count FROM documents WHERE candidate_id = $1`,
            [c.id]
        );
        const hasDocuments = parseInt(docsRes.rows[0].count) > 0;

        const candidate = {
            name: c.name || 'Candidate',
            status: c.status || 'NEW',
            hasDocs: hasDocuments,
            jobPreference: c.role || 'General',
            country: c.country || 'Unknown',
        };

        return NextResponse.json({ candidate });
    } catch (error) {
        console.error('Data Fetch Error:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
