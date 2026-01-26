import { put } from '@vercel/blob';

export const config = {
    runtime: 'edge',
};

export default async function handler(req) {
    if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
    }

    const { searchParams } = new URL(req.url);
    const filename = searchParams.get('filename');
    const type = searchParams.get('type');
    const email = searchParams.get('email');

    if (!filename || !email) {
        return new Response('Missing filename or email', { status: 400 });
    }

    // Create a clean path structure
    // candidates/borivoje@gmail.com/passport-12345.jpg
    const path = `candidates/${email}/${type}-${Date.now()}-${filename}`;

    try {
        const blob = await put(path, req.body, {
            access: 'public',
            token: process.env.BLOB_READ_WRITE_TOKEN, // Explicitly use token if needed, usually auto-injected
        });

        return new Response(JSON.stringify(blob), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
