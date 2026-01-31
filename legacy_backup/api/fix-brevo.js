
// Node.js runtime for stability
// export const config = { runtime: 'edge' };

export default async function handler(req) {
    const apiKey = process.env.BREVO_API_KEY;

    // HTML Helper
    const htmlResponse = (title, message, color, detail = '') => {
        return new Response(
            `<!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 40px; text-align: center; background: #f9fafb; }
                    .card { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 500px; margin: 0 auto; }
                    h1 { color: ${color}; margin-bottom: 20px; }
                    p { color: #4b5563; line-height: 1.5; }
                    code { background: #f3f4f6; padding: 4px 8px; border-radius: 4px; display: block; margin: 20px 0; word-break: break-all; }
                    .btn { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 20px; }
                    .btn:hover { background: #1d4ed8; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h1>${title}</h1>
                    <p>${message}</p>
                    ${detail ? `<code>${detail}</code>` : ''}
                    <a href="/admin" class="btn">Return to Dashboard</a>
                </div>
            </body>
            </html>`,
            {
                status: 200,
                headers: { 'content-type': 'text/html' }
            }
        );
    };

    if (!apiKey) {
        return htmlResponse('Configuration Error', 'Missing BREVO_API_KEY environment variable.', '#dc2626');
    }

    try {
        // Direct attempt to create the attribute
        // Endpoint: POST https://api.brevo.com/v3/contacts/attributes/normal/LEAD_STATUS
        const response = await fetch('https://api.brevo.com/v3/contacts/attributes/normal/LEAD_STATUS', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': apiKey,
                'content-type': 'application/json'
            },
            body: JSON.stringify({ type: "text" })
        });

        const text = await response.text();

        if (response.ok) {
            // Now try to create PHONE attribute
            const phoneRes = await fetch('https://api.brevo.com/v3/contacts/attributes/normal/PHONE', {
                method: 'POST',
                headers: {
                    'accept': 'application/json',
                    'api-key': apiKey,
                    'content-type': 'application/json'
                },
                body: JSON.stringify({ type: "text" })
            });

            return htmlResponse('Success! 🎉', 'The LEAD_STATUS and PHONE attributes have been checked/created.', '#059669', 'Status: Ready');
        }

        // Handle "Already Exists" errors
        // Brevo returns: {"code":"invalid_parameter","message":"Attribute name must be unique"} or "already exists"
        if (text.includes("already exists") || text.includes("must be unique")) {
            // Try creating PHONE even if LEAD_STATUS exists
            await fetch('https://api.brevo.com/v3/contacts/attributes/normal/PHONE', {
                method: 'POST',
                headers: { 'accept': 'application/json', 'api-key': apiKey, 'content-type': 'application/json' },
                body: JSON.stringify({ type: "text" })
            });
            return htmlResponse('All Good! 👍', 'The database is ready. Attributes already exist or were created.', '#2563eb', 'Status: Active');
        }

        return htmlResponse('Failed 😔', 'Could not create attribute.', '#dc2626', text);

    } catch (e) {
        return htmlResponse('Script Error', 'Something went wrong executing the script.', '#dc2626', e.message);
    }
}
