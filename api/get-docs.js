import { list } from '@vercel/blob';

export const config = {
    runtime: 'edge',
};

export default async function handler(req) {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    if (!email) {
        return new Response('Missing email', { status: 400 });
    }

    try {
        const { blobs } = await list({ permission: "public", prefix: `candidates/${email}/` });

        return new Response(JSON.stringify({ files: blobs }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
