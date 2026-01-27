
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
    const apiKey = process.env.BREVO_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: 'Missing BREVO_API_KEY' });
    }

    try {
        let allContacts = [];
        let offset = 0;
        const limit = 50;
        let hasMore = true;

        // 1. Fetch all contacts from Brevo
        while (hasMore) {
            const response = await fetch(`https://api.brevo.com/v3/contacts?limit=${limit}&offset=${offset}&sort=desc`, {
                method: 'GET',
                headers: { 'accept': 'application/json', 'api-key': apiKey }
            });

            if (!response.ok) throw new Error('Failed to fetch from Brevo');

            const data = await response.json();
            const contacts = data.contacts || [];
            allContacts = [...allContacts, ...contacts];

            if (contacts.length < limit) hasMore = false;
            else offset += limit;
        }

        console.log(`Found ${allContacts.length} contacts. Starting import...`);
        const results = { success: 0, failed: 0, errors: [] };

        // 2. Insert into Postgres
        for (const contact of allContacts) {
            try {
                const attrs = contact.attributes || {};
                // Normalize attributes
                const normalizedAttrs = {};
                Object.keys(attrs).forEach(k => normalizedAttrs[k.toUpperCase()] = attrs[k]);
                const getAttr = (k) => normalizedAttrs[k] || normalizedAttrs[k.replace('_', ' ')] || '';

                const email = contact.email;
                const name = `${normalizedAttrs['FIRSTNAME'] || ''} ${normalizedAttrs['LASTNAME'] || ''}`.trim() || email.split('@')[0];
                const phone = getAttr('PHONE') || getAttr('SMS') || '';
                const country = getAttr('COUNTRY') || 'Unknown';
                const role = getAttr('ROLE') || 'Unknown';
                const jobPref = getAttr('JOB_PREFERENCE');
                let status = getAttr('LEAD_STATUS') || 'NEW';

                // Normalizing Status to match what we want in DB
                if (!status || status === '') status = 'NEW';

                // Insert Candidate
                const candidateRes = await sql`
                    INSERT INTO candidates (email, name, phone, country, role, job_preference, status, created_at)
                    VALUES (${email}, ${name}, ${phone}, ${country}, ${role}, ${jobPref}, ${status}, ${contact.createdAt ? new Date(contact.createdAt).toISOString() : new Date().toISOString()})
                    ON CONFLICT (email) DO UPDATE 
                    SET 
                        name = EXCLUDED.name,
                        phone = EXCLUDED.phone,
                        status = EXCLUDED.status,
                        updated_at = NOW()
                    RETURNING id;
                `;

                const candidateId = candidateRes.rows[0].id;

                // Handle Documents (if stored in DOC_TYPES)
                const docTypes = getAttr('DOC_TYPES');
                if (docTypes) {
                    const types = docTypes.split(',').map(t => t.trim());
                    for (const type of types) {
                        if (!type) continue;
                        // We don't have the URL here unfortunately, but we can log that they have it.
                        // Ideally we would fetch files from Blob list, but for now let's just create a placeholder or skip
                        // Actually, let's skip creating "dummy" document rows to avoid broken links.
                        // Only real uploads (via upload-file.js) will create valid document rows.
                    }
                }

                results.success++;
            } catch (err) {
                console.error(`Failed to import ${contact.email}:`, err);
                results.failed++;
                results.errors.push(`${contact.email}: ${err.message}`);
            }
        }

        return res.status(200).json({
            message: 'Migration completed',
            stats: results
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
