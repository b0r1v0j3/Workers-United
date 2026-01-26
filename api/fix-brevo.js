export const config = {
    runtime: 'edge',
};

export default async function handler(req) {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
        return new Response('Missing API Key', { status: 500 });
    }

    try {
        // Correct Endpoint: /contacts/attributes/normal/{attributeName}
        const res = await fetch('https://api.brevo.com/v3/contacts/attributes/normal/LEAD_STATUS', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': apiKey,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                type: "text"
            })
        });

        const text = await res.text();

        if (res.ok) {
            return new Response(`SUCCESS! Created LEAD_STATUS attribute. Now your buttons will work. Refresh your admin panel.`, { status: 200 });
        } else {
            // "Attribute already exists" error handling
            if (text.includes("already exists")) {
                return new Response(`Attribute LEAD_STATUS already exists. If status is still not saving, please check Brevo manually. Error: ${text}`, { status: 200 });
            }
            return new Response(`Failed to create attribute. API Response: ${text}`, { status: 400 });
        }

    } catch (error) {
        return new Response(`Error: ${error.message}`, { status: 500 });
    }
}
