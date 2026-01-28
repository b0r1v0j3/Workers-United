// Document Progress API - Save and Load wizard progress
// Allows candidates to pause and resume document submission

import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const email = req.query.email || req.body?.email;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    try {
        // GET: Load saved progress
        if (req.method === 'GET') {
            const result = await sql`
                SELECT 
                    c.id,
                    c.name,
                    c.email,
                    c.phone,
                    c.country,
                    dr.last_step,
                    dr.personal_info,
                    dr.passport_verified,
                    dr.photo_verified,
                    dr.diploma_verified,
                    dr.all_completed
                FROM candidates c
                LEFT JOIN document_requirements dr ON c.id = dr.candidate_id
                WHERE c.email = ${email}
                LIMIT 1
            `;

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Candidate not found' });
            }

            const candidate = result.rows[0];

            return res.status(200).json({
                success: true,
                candidate: {
                    name: candidate.name,
                    email: candidate.email
                },
                progress: {
                    lastStep: candidate.last_step || 1,
                    personalInfo: candidate.personal_info || {},
                    passportVerified: candidate.passport_verified || false,
                    photoVerified: candidate.photo_verified || false,
                    diplomaVerified: candidate.diploma_verified || false,
                    allCompleted: candidate.all_completed || false
                }
            });
        }

        // POST: Save progress
        if (req.method === 'POST') {
            const { lastStep, personalInfo, completed } = req.body;

            // Get candidate ID
            const candidateResult = await sql`
                SELECT id FROM candidates WHERE email = ${email} LIMIT 1
            `;

            if (candidateResult.rows.length === 0) {
                return res.status(404).json({ error: 'Candidate not found' });
            }

            const candidateId = candidateResult.rows[0].id;

            // Check if document_requirements record exists
            const existingResult = await sql`
                SELECT id FROM document_requirements WHERE candidate_id = ${candidateId} LIMIT 1
            `;

            if (existingResult.rows.length === 0) {
                // Create new record
                await sql`
                    INSERT INTO document_requirements (candidate_id, last_step, personal_info, all_completed)
                    VALUES (${candidateId}, ${lastStep || 1}, ${JSON.stringify(personalInfo || {})}, ${completed || false})
                `;
            } else {
                // Update existing record
                await sql`
                    UPDATE document_requirements
                    SET last_step = ${lastStep || 1},
                        personal_info = ${JSON.stringify(personalInfo || {})},
                        all_completed = ${completed || false},
                        updated_at = NOW()
                    WHERE candidate_id = ${candidateId}
                `;
            }

            // If completed, update candidate status
            if (completed) {
                await sql`
                    UPDATE candidates
                    SET status = 'DOCS_RECEIVED'
                    WHERE id = ${candidateId}
                `;

                console.log(`✅ Candidate ${email} completed document submission`);
            }

            return res.status(200).json({
                success: true,
                message: completed ? 'Application submitted successfully!' : 'Progress saved'
            });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('Document progress error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
