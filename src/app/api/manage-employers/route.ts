import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
    try {
        const result = await query('SELECT * FROM employers ORDER BY created_at DESC');
        return NextResponse.json(result.rows);
    } catch (error) {
        console.error('Employer API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            email, name, company_name, location,
            workers_needed, industry, work_type,
            start_date, provides_housing, phone
        } = body;

        if (!email || !company_name || !phone) {
            return NextResponse.json({ error: 'Email, Company Name, and Phone are required' }, { status: 400 });
        }

        try {
            const result = await query(
                `INSERT INTO employers (
            email, name, company_name, location, 
            workers_needed, industry, work_type, 
            start_date, provides_housing, phone, status
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'ACTIVE')
          RETURNING *`,
                [
                    email, name, company_name, location,
                    workers_needed || 1, industry, work_type,
                    start_date, provides_housing || false, phone
                ]
            );
            return NextResponse.json(result.rows[0], { status: 201 });
        } catch (dbError: any) {
            if (dbError.code === '23505') {
                return NextResponse.json({ error: 'Employer with this email already exists' }, { status: 409 });
            }
            throw dbError;
        }
    } catch (error) {
        console.error('Employer API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const {
            id, email, name, company_name, location,
            workers_needed, industry, work_type,
            start_date, provides_housing, phone, status
        } = body;

        if (!id) {
            return NextResponse.json({ error: 'Employer ID is required' }, { status: 400 });
        }

        const result = await query(
            `UPDATE employers
         SET 
            email = $1, name = $2, 
            company_name = $3, location = $4,
            workers_needed = $5, industry = $6,
            work_type = $7, start_date = $8,
            provides_housing = $9, phone = $10,
            status = $11,
            updated_at = NOW()
         WHERE id = $12
         RETURNING *`,
            [
                email, name, company_name, location,
                workers_needed, industry, work_type,
                start_date, provides_housing, phone,
                status || 'ACTIVE', id
            ]
        );

        if (result.rows.length === 0) {
            return NextResponse.json({ error: 'Employer not found' }, { status: 404 });
        }

        return NextResponse.json(result.rows[0]);

    } catch (error) {
        console.error('Employer API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'Employer ID is required' }, { status: 400 });
    }

    try {
        await query('DELETE FROM employers WHERE id = $1', [id]);
        return NextResponse.json({ message: 'Employer deleted successfully' });
    } catch (error) {
        console.error('Employer API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
