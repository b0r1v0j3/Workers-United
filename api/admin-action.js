export const config = {
    runtime: 'edge',
};

export default async function handler(req) {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ message: 'Method Not Allowed' }), { status: 405 });
    }

    try {
        const { action, email, name, password } = await req.json();

        // Security check
        if (password !== 'admin123') { // Temporary password
            return new Response(JSON.stringify({ success: false, message: 'Unauthorized' }), { status: 401 });
        }

        const apiKey = process.env.BREVO_API_KEY;
        if (!apiKey) {
            return new Response(JSON.stringify({ message: 'Server configuration error' }), { status: 500 });
        }

        let subject = '';
        let htmlContent = '';
        let statusLabel = '';

        // Define Email Templates based on Action
        switch (action) {
            case 'request_docs':
                subject = 'Next steps - Workers United';
                statusLabel = 'DOCS REQUESTED';
                htmlContent = `
          <p>Hello ${name},</p>
          <p>Thank you for your message and for your interest in working with Workers United.</p>
          <p>Before we can confirm whether we can assist you, we first need to review your basic information and documents.</p>
          <p>This step is free of charge and allows us to determine if your case is realistic and legally viable.</p>
          <p><strong>Please send the following documents and information:</strong></p>
          <ul>
            <li>Passport (photo page)</li>
            <li>Diploma or certificate of completed education</li>
            <li>Country you are currently residing in</li>
            <li>Type of job you are looking for</li>
          </ul>
          <p><em>Please note that a completed education diploma is required for the work visa process and is a mandatory document.</em></p>
          <p>Once we receive and review these documents, we will inform you whether we can proceed and explain the next steps.</p>
          <br/>
          <p>Kind regards,</p>
          <p><strong>Workers United LLC</strong></p>
        `;
                break;

            case 'docs_received':
                subject = 'Documents received - under review';
                statusLabel = 'UNDER REVIEW';
                htmlContent = `
          <p>Hello ${name},</p>
          <p>We have received your documents. Thank you.</p>
          <p>Our team will now review your information and assess whether we can realistically assist you with the process.</p>
          <p>This review may take some time, as we want to be precise and transparent.</p>
          <p>We will contact you once the review is completed.</p>
          <br/>
          <p>Best regards,</p>
          <p><strong>Workers United LLC</strong></p>
        `;
                break;

            case 'reject':
                subject = 'Update regarding your request';
                statusLabel = 'REJECTED';
                htmlContent = `
          <p>Hello ${name},</p>
          <p>Thank you for your time and for providing the requested information.</p>
          <p>After reviewing your documents, we regret to inform you that at this moment we are not able to assist with your case.</p>
          <p>This may be due to legal limitations, employer requirements, or current market conditions.</p>
          <p>We appreciate your understanding and wish you success in your future efforts.</p>
          <br/>
          <p>Kind regards,</p>
          <p><strong>Workers United LLC</strong></p>
        `;
                break;

            case 'approve_payment':
                subject = 'Eligibility confirmed';
                statusLabel = 'PAYMENT REQUESTED';
                htmlContent = `
          <p>Hello ${name},</p>
          <p>Thank you for your patience.</p>
          <p>After reviewing your documents, we confirm that your case is <strong>eligible for further processing</strong> with Workers United.</p>
          <p>To proceed, a service fee is required.</p>
          <p>The coordination and work visa application process officially starts only after payment is completed.</p>
          <p>You can complete the payment securely using the link below:</p>
          <p><a href="#" style="background: #1dbf73; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">PAYMENT LINK (Coming Soon)</a></p>
          <p>Once payment is confirmed, we will begin the preparation and submission of your work visa application and keep you informed at each stage of the process.</p>
          <br/>
          <p>Kind regards,</p>
          <p><strong>Workers United LLC</strong></p>
        `;
                break;

            default:
                return new Response(JSON.stringify({ success: false, message: 'Invalid action' }), { status: 400 });
        }

        // 1. Update Lead Status in Brevo CRM
        const updateContactRes = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
            method: 'PUT',
            headers: {
                'accept': 'application/json',
                'api-key': apiKey,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                attributes: {
                    LEAD_STATUS: statusLabel
                }
            })
        });

        // 2. Send the Email
        const sendEmailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': apiKey,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                sender: { name: "Workers United LLC", email: "contact@workersunited.eu" },
                to: [{ email: email, name: name }],
                subject: subject,
                htmlContent: htmlContent
            })
        });

        if (!sendEmailRes.ok) {
            throw new Error('Failed to send email');
        }

        return new Response(JSON.stringify({ success: true, message: `Action ${action} executed successfully` }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Admin Action Error:', error);
        return new Response(JSON.stringify({ success: false, message: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
