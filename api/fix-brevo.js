export default async function handler(req) {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
        return new Response('Missing API Key', { status: 500 });
    }

    try {
        // 1. List existing attributes to see if it's there
        const listRes = await fetch('https://api.brevo.com/v3/contacts/attributes', {
            method: 'GET',
            headers: { 'api-key': apiKey }
        });

        if (!listRes.ok) {
            return new Response(`Failed to list attributes: ${await listRes.text()}`, { status: 400 });
        }

        const data = await listRes.json();
        const attributes = data.attributes || [];
        const exists = attributes.find(a => a.name === 'LEAD_STATUS');

        if (exists) {
            return new Response(`SUCCESS: Attribute LEAD_STATUS already exists! You are good to go.`, { status: 200 });
        }

        // 2. If not exists, try to create it using the "standard" path structure
        // According to docs: POST /contacts/attributes/{category}/{name}
        const createRes = await fetch('https://api.brevo.com/v3/contacts/attributes/normal/LEAD_STATUS', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': apiKey,
                'content-type': 'application/json'
            },
            body: JSON.stringify({ type: "text" })
        });

        if (createRes.ok) {
            return new Response(`SUCCESS: Created LEAD_STATUS.`, { status: 200 });
        }

        const errorText = await createRes.text();

        // 3. Fallback: Try the "body" method if the URL path method failed
        const createRes2 = await fetch('https://api.brevo.com/v3/contacts/attributes/normal', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': apiKey,
                'content-type': 'application/json'
            },
            body: JSON.stringify({ value: "LEAD_STATUS", type: "text" })
        });

        if (createRes2.ok) {
            return new Response(`SUCCESS: Created LEAD_STATUS (fallback method).`, { status: 200 });
        }

        return new Response(`Failed to create. \nMethod 1 Error: ${errorText} \nMethod 2 Error: ${await createRes2.text()}`, { status: 400 });

    } catch (error) {
        return new Response(`Script Error: ${error.message}`, { status: 500 });
    }
}
