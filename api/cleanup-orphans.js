import { list, del } from '@vercel/blob';

export default async function handler(req, res) {
    // Basic security: Check for secret query param
    if (req.query.secret !== 'clean_my_mess_plz') {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const apiKey = process.env.BREVO_API_KEY;
        if (!apiKey) throw new Error("Missing Brevo key");

        // 1. Fetch all active emails from Brevo
        let activeEmails = new Set();
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
            const brevoRes = await fetch(`https://api.brevo.com/v3/contacts?limit=50&offset=${offset}`, {
                headers: { 'api-key': apiKey }
            });
            const data = await brevoRes.json();
            const contacts = data.contacts || [];

            contacts.forEach(c => activeEmails.add(c.email.toLowerCase()));

            if (contacts.length < 50) hasMore = false;
            offset += 50;
        }

        console.log(`Active unique contacts: ${activeEmails.size}`);

        // 2. Fetch all blobs from Vercel
        const { blobs } = await list({
            prefix: 'candidates/',
            token: process.env.BLOB_READ_WRITE_TOKEN
        });

        const orphans = [];

        // 3. Identify Orphans
        for (const blob of blobs) {
            // Path format: candidates/email@domain.com/filename
            const parts = blob.pathname.split('/');
            if (parts.length >= 3) {
                const emailInBlob = parts[1].toLowerCase();
                // Decode if it was URI encoded (unlikely for folders but possible)
                const decodedEmail = decodeURIComponent(emailInBlob);

                if (!activeEmails.has(decodedEmail)) {
                    orphans.push(blob.url);
                }
            }
        }

        // 4. Delete orphans
        if (orphans.length > 0) {
            await del(orphans, { token: process.env.BLOB_READ_WRITE_TOKEN });
        }

        return res.status(200).json({
            message: 'Cleanup successful',
            activeContacts: activeEmails.size,
            totalBlobs: blobs.length,
            deletedOrphans: orphans.length,
            orphans
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
}
