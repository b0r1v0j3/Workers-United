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
    const { name, email, phone, country, role, message, job_preference } = req.body;

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
            <p><strong>Preferred Job:</strong> ${job_preference || 'Not specified'}</p>
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

    // 2. Send Enhanced Auto-Reply to User
    const userBody = `
            <h1>🎉 Thank You for Your Interest, ${name}!</h1>
            <p>Dear ${name},</p>
            <p>We are delighted that you have chosen Workers United to explore <strong>${role}</strong> opportunities abroad.</p>
            
            <div class="info-box">
                <strong>✅ Your Application Has Been Received</strong><br>
                We have successfully recorded your details and will review your profile within the next 24-48 hours.
            </div>

            <h3>What Happens Next?</h3>
            <ol style="line-height: 2;">
                <li><strong>Initial Review</strong> – Our team will evaluate your profile against current job openings in Europe</li>
                <li><strong>Tailored Information</strong> – You will receive specific information about work visa opportunities that match your profile and target European countries</li>
                <li><strong>Document Requirements</strong> – If there is a good match, we will guide you through the document preparation process</li>
                <li><strong>Legal Support</strong> – Our legal team will assist with all visa paperwork and employment contracts</li>
            </ol>

            <h3>💼 Why Choose Workers United?</h3>
            <ul style="line-height: 1.8;">
                <li>✅ <strong>100% Legal Process</strong> – Full compliance with EU labor laws</li>
                <li>✅ <strong>Transparent Pricing</strong> – No hidden fees, clear service agreements</li>
                <li>✅ <strong>End-to-End Support</strong> – From application to arrival in Europe</li>
                <li>✅ <strong>Verified Employers</strong> – We only work with licensed, reputable companies</li>
            </ul>

            <p style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;">
                <strong>📧 Check Your Email</strong><br>
                Our response will come from <strong>contact@workersunited.eu</strong>. Please check your spam folder if you don't see it in your inbox.
            </p>

            <p>In the meantime, feel free to explore our website to learn more about our services:</p>
            <p style="text-align: center;">
                <a href="https://workersunited.eu" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Visit Our Website</a>
            </p>

            <p><strong>📚 Have Questions?</strong> Visit our FAQ page for instant answers to common questions:</p>
            <p style="text-align: center;">
                <a href="https://workersunited.eu/faq" style="background-color: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">📖 Browse FAQ</a>
            </p>
            
            <p style="margin-top: 30px;"><strong>Best regards,</strong><br>Workers United Team<br><em>Legal International Hiring & Work Visa Support</em></p>
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
              JOB_PREFERENCE: job_preference || '',
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

    // Function to Save Contact to Postgres (NEW!)
    const savePostgresContact = async () => {
      try {
        const { sql } = await import('@vercel/postgres');

        await sql`
          INSERT INTO candidates (email, name, phone, country, role, job_preference, status)
          VALUES (${email}, ${name}, ${phone}, ${country}, ${role}, ${job_preference || ''}, 'NEW')
          ON CONFLICT (email) 
          DO UPDATE SET 
            name = EXCLUDED.name,
            phone = EXCLUDED.phone,
            country = EXCLUDED.country,
            role = EXCLUDED.role,
            job_preference = EXCLUDED.job_preference,
            updated_at = NOW()
        `;

        console.log(`✅ Saved ${email} to Postgres`);
        return { ok: true };
      } catch (err) {
        console.error('❌ Postgres save failed:', err);
        return { ok: false, error: err.message };
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

      // 2. Send User Email & Save to both Brevo CRM and Postgres (Attempt all, don't fail if they error)
      const results = await Promise.allSettled([
        sendBrevoEmail(emailToUser),
        saveBrevoContact(),
        savePostgresContact() // NEW: Also save to Postgres
      ]);

      // Log any failures
      results.forEach((result, index) => {
        const labels = ['User Auto-reply', 'Brevo CRM Save', 'Postgres DB Save'];
        if (result.status === 'rejected') {
          console.error(`${labels[index]} failed:`, result.reason);
        } else if (index === 2 && result.value?.ok === false) {
          console.error(`${labels[index]} failed:`, result.value.error);
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
