
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-auth-token');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { employerId } = req.query;

    if (!employerId) {
        return res.status(400).json({ error: 'Employer ID is required' });
    }

    try {
        // 1. Get Employer Details
        const employerResult = await sql`
            SELECT * FROM employers WHERE id = ${employerId}
        `;

        if (employerResult.rows.length === 0) {
            return res.status(404).json({ error: 'Employer not found' });
        }

        const employer = employerResult.rows[0];

        // 2. Get All Approved Candidates with their requirements data
        // We join to get the structured personal_info JSON
        const candidatesResult = await sql`
            SELECT c.id, c.name, c.email, c.phone, c.country, c.status, dr.personal_info
            FROM candidates c
            LEFT JOIN document_requirements dr ON c.id = dr.candidate_id
            WHERE c.status = 'APPROVED' OR c.status = 'DOCS_RECEIVED'
        `;
        // Note: Including DOCS_RECEIVED for testing if APPROVED list is empty

        const matches = candidatesResult.rows.map(candidate => {
            let score = 0;
            const reasons = [];
            const info = candidate.personal_info || {};

            // Industry Match
            const preferredJob = info.preferredJob || 'Any';

            if (matchedIndustry(preferredJob, employer.industry)) {
                score += 50;
                reasons.push('Industry Match');
            } else if (preferredJob === 'Any') {
                score += 30;
                reasons.push('Open to Any Job');
            }

            // Location Match (Simple fuzzy check)
            // e.g. Candidate: "Lagos, Nigeria", Employer: "Munich, Germany" -> No match
            // We check if candidate country matches employer location roughly
            if (employer.location && (
                (info.address && info.address.includes(employer.location)) ||
                (info.nationality && employer.location.includes(info.nationality))
            )) {
                score += 30;
                reasons.push('Location Preference');
            }

            // Status Bonus
            if (candidate.status === 'APPROVED') {
                score += 20;
                reasons.push('Fully Verified');
            }

            return {
                ...candidate,
                score,
                match_reasons: reasons
            };
        });

        // Filter and Sort
        const topMatches = matches
            .filter(m => m.score > 0)
            .sort((a, b) => b.score - a.score);

        return res.status(200).json({
            employer: employer.company_name,
            total_candidates: candidatesResult.rows.length,
            matches: topMatches
        });

    } catch (error) {
        console.error('Matching API Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}

function matchedIndustry(candidateJob, employerIndustry) {
    if (!candidateJob || !employerIndustry) return false;
    const c = candidateJob.toLowerCase();
    const e = employerIndustry.toLowerCase();
    return c === e || e.includes(c) || c.includes(e);
}
