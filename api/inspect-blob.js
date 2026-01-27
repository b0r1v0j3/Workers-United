import { list } from '@vercel/blob';

export default async function handler(req, res) {
    try {
        const { blobs } = await list();

        // Return detailed info about first 10 blobs for inspection
        const sample = blobs.slice(0, 10).map(b => ({
            pathname: b.pathname,
            url: b.url,
            size: b.size,
            uploadedAt: b.uploadedAt
        }));

        return res.status(200).json({
            total: blobs.length,
            sample,
            all_pathnames: blobs.map(b => b.pathname)
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
