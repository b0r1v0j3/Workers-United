
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-auth-token');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        // GET: List all employers
        if (req.method === 'GET') {
            const result = await sql`
                SELECT * FROM employers 
                ORDER BY created_at DESC
            `;
            return res.status(200).json(result.rows);
        }

        // POST: Create new employer
        if (req.method === 'POST') {
            const {
                email, name, company_name, location,
                workers_needed, industry, work_type,
                start_date, provides_housing, phone
            } = req.body;

            // Basic Validation
            if (!email || !company_name) {
                return res.status(400).json({ error: 'Email and Company Name are required' });
            }

            try {
                const result = await sql`
                    INSERT INTO employers (
                        email, name, company_name, location, 
                        workers_needed, industry, work_type, 
                        start_date, provides_housing, phone, status
                    )
                    VALUES (
                        ${email}, ${name}, ${company_name}, ${location}, 
                        ${workers_needed || 1}, ${industry}, ${work_type}, 
                        ${start_date}, ${provides_housing || false}, ${phone}, 'ACTIVE'
                    )
                    RETURNING *
                `;
                return res.status(201).json(result.rows[0]);
            } catch (dbError) {
                if (dbError.code === '23505') { // Unique violation
                    return res.status(409).json({ error: 'Employer with this email already exists' });
                }
                throw dbError;
            }
        }

        // PUT: Update employer
        if (req.method === 'PUT') {
            const {
                id, email, name, company_name, location,
                workers_needed, industry, work_type,
                start_date, provides_housing, phone, status
            } = req.body;

            if (!id) {
                return res.status(400).json({ error: 'Employer ID is required' });
            }

            const result = await sql`
                UPDATE employers
                SET 
                    email = ${email}, name = ${name}, 
                    company_name = ${company_name}, location = ${location},
                    workers_needed = ${workers_needed}, industry = ${industry},
                    work_type = ${work_type}, start_date = ${start_date},
                    provides_housing = ${provides_housing}, phone = ${phone},
                    status = ${status || 'ACTIVE'},
                    updated_at = NOW()
                WHERE id = ${id}
                RETURNING *
            `;

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Employer not found' });
            }

            return res.status(200).json(result.rows[0]);
        }

        // DELETE: Remove employer
        if (req.method === 'DELETE') {
            const { id } = req.query;

            if (!id) {
                return res.status(400).json({ error: 'Employer ID is required' });
            }

            await sql`DELETE FROM employers WHERE id = ${id}`;
            return res.status(200).json({ message: 'Employer deleted successfully' });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('Employer API Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
