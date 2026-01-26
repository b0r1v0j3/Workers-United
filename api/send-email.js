import { getEmailTemplate } from './email-template.js';

export const config = {
  runtime: 'edge', // Using Edge runtime for faster cold starts and standard fetch API
};

export default async function handler(req) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ message: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { name, email, country, role, message } = await req.json();

    if (!name || !email || !message) {
      return new Response(JSON.stringify({ message: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiKey = process.env.BREVO_API_KEY;

    if (!apiKey) {
      console.error('Missing BREVO_API_KEY');
      return new Response(JSON.stringify({ message: 'Server configuration error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 1. Send Email to Owner (Internal Notification - Keep simple or brand as well)
    // We'll keep it simple HTML for owner or brand it? Let's brand it for consistency.
    const ownerContent = `
        <h2>New Website Inquiry</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Country:</strong> ${country}</p>
        <p><strong>Role:</strong> ${role}</p>
        <hr/>
        <h3>Message:</h3>
        <p>${message}</p>
    `;

    const emailToOwner = {
      sender: { name: "Workers United Site", email: "contact@workersunited.eu" },
      to: [{ email: "contact@workersunited.eu", name: "Workers United Team" }],
      cc: [{ email: "cvetkovicborivoje@gmail.com", name: "Borivoje" }],
      subject: `New Inquiry from ${name} (${role})`,
      htmlContent: getEmailTemplate(`New Inquiry: ${name}`, ownerContent)
    };

    // 2. Send Auto-Reply to User
    const userBody = `
        <p>Dear ${name},</p>
        <p>Thank you for contacting Workers United.</p>
        <p>We have received your inquiry regarding <strong>${role}</strong> opportunities.</p>
        <p class="info-box">Our team is currently reviewing your details. We usually reply within 24-48 hours with specific information valid for your country (${country}).</p>
        <p>Thank you for your patience.</p>
    `;

    const emailToUser = {
      sender: { name: "Workers United", email: "contact@workersunited.eu" },
      to: [{ email: email, name: name }],
      subject: "We received your message - Workers United",
      htmlContent: getEmailTemplate('Message Received', userBody)
    };

    // Function to call Brevo API for triggering emails
    const sendBrevoEmail = async (payload) => {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': apiKey,
          'content-type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      return res;
    };

    // Function to Create/Update Contact in Brevo CRM
    const saveBrevoContact = async () => {
      // First, try to create the contact
      let res = await fetch('https://api.brevo.com/v3/contacts', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': apiKey,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          email: email,
          attributes: {
            FIRSTNAME: name.split(' ')[0],
            LASTNAME: name.split(' ').slice(1).join(' ') || '',
            COUNTRY: country,
            ROLE: role,
            LEAD_STATUS: 'NEW' // Custom attribute for our funnel
          },
          updateEnabled: true // If exists, update it
        })
      });
      return res;
    };

    // Execute all in parallel
    const [ownerRes, userRes, contactRes] = await Promise.all([
      sendBrevoEmail(emailToOwner),
      sendBrevoEmail(emailToUser),
      saveBrevoContact()
    ]);

    if (!ownerRes.ok) {
      const errorData = await ownerRes.text();
      console.error('Brevo Error (Owner):', errorData);
      throw new Error('Failed to send email to owner');
    }

    return new Response(JSON.stringify({ success: true, message: 'Message sent successfully' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Handler Error:', error);
    return new Response(JSON.stringify({ success: false, message: 'Failed to process request: ' + error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
