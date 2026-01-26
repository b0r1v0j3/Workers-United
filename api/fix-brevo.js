export const config = {
    runtime: 'edge',
};

export default async function handler(req) {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
        return new Response('Missing API Key', { status: 500 });
    }

    try {
        // 1. Try to create the attribute
        const res = await fetch('https://api.brevo.com/v3/contacts/attributes/normal', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': apiKey,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                value: "LEAD_STATUS",
                type: "text"
            })
        });

        const text = await res.text();

        if (res.ok) {
            return new Response(`SUCCESS! Created LEAD_STATUS attribute. Now your buttons will work. Refresh your admin panel.`, { status: 200 });
        } else {
            // If it fails, maybe it already exists?
            if (text.includes("already exists")) {
                return new Response(`Attribute LEAD_STATUS already exists. If status is still not saving, please check Brevo manually. Error: ${text}`, { status: 200 });
            }
            return new Response(`Failed to create attribute: ${text}`, { status: 400 });
        }

    } catch (error) {
        return new Response(`Error: ${error.message}`, { status: 500 });
    }
}
