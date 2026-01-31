import { sql } from '@vercel/postgres';
import { list } from '@vercel/blob';

export default async function handler(req, res) {
    try {
        console.log('Starting Blob → Postgres sync...');

        // 1. List all files from Vercel Blob
        const { blobs } = await list();
        console.log(`Found ${blobs.length} files in Blob`);

        let synced = 0;
        let skipped = 0;
        let errors = [];

        // 2. Process each blob file
        for (const blob of blobs) {
            try {
                // Extract email from pathname (format: candidates/{email}/{type}-{timestamp}-{filename})
                const pathParts = blob.pathname.split('/');
                if (pathParts[0] !== 'candidates' || !pathParts[1]) {
                    skipped++;
                    console.log(`⏭️ Skipped: ${blob.pathname} (not in candidates folder)`);
                    continue;
                }

                const email = decodeURIComponent(pathParts[1]);
                const filenameWithPrefix = pathParts[2] || 'unknown';

                // Extract actual filename (format: {type}-{timestamp}-{filename})
                const parts = filenameWithPrefix.split('-');
                const docType = parts[0] || 'Document'; // First part is type
                const filename = parts.slice(2).join('-') || filenameWithPrefix; // Rest is filename

                // Find candidate by email
                const candidateRes = await sql`
                    SELECT id FROM candidates WHERE email = ${email}
                `;

                if (candidateRes.rows.length === 0) {
                    // Create candidate if doesn't exist
                    const newCandidateRes = await sql`
                        INSERT INTO candidates (email, name, status)
                        VALUES (${email}, ${email.split('@')[0]}, 'DOCS RECEIVED')
                        RETURNING id
                    `;
                    var candidateId = newCandidateRes.rows[0].id;
                } else {
                    var candidateId = candidateRes.rows[0].id;
                }

                // Check if document already exists
                const existingDoc = await sql`
                    SELECT id FROM documents 
                    WHERE candidate_id = ${candidateId} AND file_url = ${blob.url}
                `;

                if (existingDoc.rows.length === 0) {
                    // Insert document
                    await sql`
                        INSERT INTO documents (candidate_id, file_url, file_type, created_at)
                        VALUES (${candidateId}, ${blob.url}, ${docType}, ${blob.uploadedAt})
                    `;
                    synced++;
                    console.log(`✅ Synced: ${filename} for ${email}`);
                } else {
                    skipped++;
                }

            } catch (err) {
                errors.push({ blob: blob.pathname, error: err.message });
                console.error(`❌ Error syncing ${blob.pathname}:`, err);
            }
        }

        return res.status(200).json({
            message: 'Sync completed',
            stats: {
                total_blobs: blobs.length,
                synced,
                skipped,
                errors: errors.length
            },
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        console.error('Sync Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
