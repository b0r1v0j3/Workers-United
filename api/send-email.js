import { getEmailTemplate } from './email-template.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'x-auth-token, Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { name, email, phone, country, role, message } = req.body;

    if (!name || !email || !phone || !message) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const apiKey = process.env.BREVO_API_KEY;

    if (!apiKey) {
      console.error('Missing BREVO_API_KEY');
      return res.status(500).json({ message: 'Server configuration error' });
    }

    // 1. Send Email to Owner
    const ownerContent = `
            <h2>New Website Inquiry</h2>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Phone:</strong> ${phone}</p>
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

    // Function to call Brevo API
    const sendBrevoEmail = async (payload) => {
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      try {
        const res = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'api-key': apiKey,
            'content-type': 'application/json'
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        return res;
      } catch (err) {
        clearTimeout(timeoutId);
        throw err;
      }
    };

    // Function to Create/Update Contact in Brevo CRM
    const saveBrevoContact = async () => {
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      try {
        const res = await fetch('https://api.brevo.com/v3/contacts', {
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
              PHONE: phone,
              COUNTRY: country,
              ROLE: role,
              LEAD_STATUS: 'NEW'
            },
            updateEnabled: true
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        return res;
      } catch (err) {
        clearTimeout(timeoutId);
        console.warn("Contact save failed lightly:", err);
        return { ok: true }; // Ignore CRM errors for now to ensure email sends
      }
    };

    // Execute sequentially/parallel but MUST await in Serverless
    try {
      // 1. Send Owner Email (Must succeed)
      const ownerRes = await sendBrevoEmail(emailToOwner);
      if (!ownerRes.ok) {
        const errText = await ownerRes.text();
        console.error('Owner email failed:', errText);
        throw new Error('Failed to send owner notification: ' + errText);
      }

      // 2. Send User Email & Save to CRM (Attempt both, don't fail if they error)
      const results = await Promise.allSettled([
        sendBrevoEmail(emailToUser),
        saveBrevoContact()
      ]);

      // Log any failures
      results.forEach((result, index) => {
        const label = index === 0 ? 'User Auto-reply' : 'CRM Contact Save';
        if (result.status === 'rejected') {
          console.error(`${label} failed:`, result.reason);
        }
      });

      return res.status(200).json({ success: true, message: 'Message sent successfully' });

    } catch (innerErr) {
      console.error("Inner Email Logic Error:", innerErr);
      return res.status(500).json({ success: false, message: 'Failed to send email: ' + innerErr.message });
    }

  } catch (error) {
    console.error('Handler Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to process request: ' + error.message });
  }
}
