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

    // Normalize role to lowercase for case-insensitive comparison
    const normalizedRole = (role || '').toLowerCase();

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

    // 2. Send Role-Based Auto-Reply to User
    let userBody = '';
    let userSubject = '';

    if (normalizedRole === 'employer') {
      // EMPLOYER EMAIL - Ask for company details
      userSubject = 'Thank you for your interest - Workers United';
      userBody = `
            <h1>🏢 Thank You for Reaching Out, ${name}!</h1>
            <p>Dear ${name},</p>
            <p>We're pleased to hear from potential employers! Workers United specializes in connecting EU businesses with qualified, vetted international workers.</p>
            
            <div class="info-box">
                <strong>✅ Your Inquiry Has Been Received</strong><br>
                Our employer relations team will review your inquiry and respond within 24 hours.
            </div>

            <h3>📋 To Better Assist You, Please Provide:</h3>
            <p>Kindly reply to this email with the following information so we can match you with suitable candidates:</p>
            
            <ul style="line-height: 2.2; font-size: 15px;">
                <li>🏭 <strong>Company Name</strong> – Full legal name of your business</li>
                <li>📍 <strong>Company Location</strong> – City and country where workers are needed</li>
                <li>👥 <strong>Number of Workers Needed</strong> – How many positions are you looking to fill?</li>
                <li>💼 <strong>Type of Work</strong> – What industry/job roles? (e.g., manufacturing, construction, hospitality)</li>
                <li>📅 <strong>Start Date</strong> – When do you need workers to begin?</li>
                <li>🏠 <strong>Accommodation</strong> – Do you provide housing for workers?</li>
            </ul>

            <p style="text-align: center; margin: 30px 0;">
                <a href="mailto:contact@workersunited.eu?subject=Employer%20Details%20-%20${encodeURIComponent(name)}" 
                   style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">
                   📧 Reply With Details
                </a>
            </p>

            <h3>💼 Why Partner With Workers United?</h3>
            <ul style="line-height: 1.8;">
                <li>✅ <strong>Pre-Screened Workers</strong> – All candidates are vetted and verified</li>
                <li>✅ <strong>Legal Compliance</strong> – We handle all visa and work permit paperwork</li>
                <li>✅ <strong>Fast Turnaround</strong> – Workers ready within weeks, not months</li>
                <li>✅ <strong>Ongoing Support</strong> – We assist with onboarding and integration</li>
            </ul>

            <p style="margin-top: 40px;"><strong>Best regards,</strong><br>The Workers United Employer Relations Team</p>
        `;
    } else if (normalizedRole === 'other') {
      // OTHER EMAIL - Simple "How can we help?"
      userSubject = 'We received your message - Workers United';
      userBody = `
            <h1>👋 Hello ${name}!</h1>
            <p>Dear ${name},</p>
            <p>Thank you for contacting Workers United. We've received your message and appreciate you reaching out.</p>
            
            <div class="info-box">
                <strong>📬 Message Received</strong><br>
                A member of our team will review your inquiry and get back to you as soon as possible.
            </div>

            <h3>How Can We Help You?</h3>
            <p>If you have a specific question or need, please feel free to reply to this email with more details so we can better assist you.</p>

            <p>Whether you're looking for information about:</p>
            <ul style="line-height: 1.8;">
                <li>🌍 Work opportunities in Europe</li>
                <li>📄 Visa and legal requirements</li>
                <li>🤝 Partnership opportunities</li>
                <li>❓ General questions about our services</li>
            </ul>

            <p>We're here to help!</p>

            <p style="text-align: center; margin: 30px 0;">
                <a href="mailto:contact@workersunited.eu?subject=Re:%20My%20Inquiry" 
                   style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                   Reply to This Message
                </a>
            </p>

            <p style="margin-top: 40px;"><strong>Best regards,</strong><br>The Workers United Team</p>
        `;
    } else {
      // WORKER / DEFAULT EMAIL - Standard job seeker flow
      userSubject = 'We received your message - Workers United';
      userBody = `
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

            <p style="margin-top: 40px;"><strong>Best regards,</strong><br>The Workers United Team</p>
        `;
    }

    const emailToUser = {
      sender: { name: "Workers United", email: "contact@workersunited.eu" },
      to: [{ email: email, name: name }],
      subject: userSubject,
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

    // Function to Queue Scheduled Emails (for automated sequences)
    const queueScheduledEmails = async () => {
      // Only queue for workers - employers have different flow
      if (normalizedRole !== 'worker') {
        return { ok: true, message: 'Not a worker, skipping email queue' };
      }

      try {
        const { sql } = await import('@vercel/postgres');

        // Queue "review_complete" email for 24 hours from now
        await sql`
          INSERT INTO email_queue (candidate_email, candidate_name, email_type, send_at)
          VALUES (${email}, ${name}, 'review_complete', NOW() + INTERVAL '24 hours')
          ON CONFLICT DO NOTHING
        `;

        console.log(`📧 Queued 24h review email for ${email}`);
        return { ok: true };
      } catch (err) {
        console.error('❌ Email queue failed:', err);
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
        savePostgresContact()
        // queueScheduledEmails() // DISABLED: Auto sequences paused until Stripe is ready
      ]);

      // Log any failures
      results.forEach((result, index) => {
        const labels = ['User Auto-reply', 'Brevo CRM Save', 'Postgres DB Save', 'Email Queue'];
        if (result.status === 'rejected') {
          console.error(`${labels[index]} failed:`, result.reason);
        } else if (result.value?.ok === false) {
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
