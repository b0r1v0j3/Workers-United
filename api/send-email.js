const brevo = require('@getbrevo/brevo');

module.exports = async (req, res) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Parse fields
  const { name, email, country, role, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  // Initialize Brevo Client
  let defaultClient = brevo.ApiClient.instance;
  let apiKey = defaultClient.authentications['api-key'];
  apiKey.apiKey = process.env.BREVO_API_KEY;

  let apiInstance = new brevo.TransactionalEmailsApi();

  try {
    // 1. Send Email to Owner (You)
    let sendSmtpEmailToOwner = new brevo.SendSmtpEmail();
    sendSmtpEmailToOwner.subject = `New Inquiry from ${name} (${role})`;
    sendSmtpEmailToOwner.htmlContent = `<html><body>
      <h2>New Website Inquiry</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Country:</strong> ${country}</p>
      <p><strong>Role:</strong> ${role}</p>
      <hr/>
      <h3>Message:</h3>
      <p>${message}</p>
    </body></html>`;
    sendSmtpEmailToOwner.sender = { "name": "Workers United Site", "email": "no-reply@workersunited.eu" };
    sendSmtpEmailToOwner.to = [{ "email": "contact@workersunited.eu", "name": "Workers United Team" }];
    
    // Also CC your personal email just in case
    sendSmtpEmailToOwner.cc = [{ "email": "cvetkovicborivoje@gmail.com", "name": "Borivoje" }];

    await apiInstance.sendTransacEmail(sendSmtpEmailToOwner);

    // 2. Send Auto-Reply to User
    let sendSmtpEmailToUser = new brevo.SendSmtpEmail();
    sendSmtpEmailToUser.subject = "We received your message - Workers United";
    sendSmtpEmailToUser.htmlContent = `<html><body>
      <p>Hello ${name},</p>
      <p>Thank you for contacting Workers United. We have received your inquiry regarding <strong>${role}</strong> opportunities.</p>
      <p>Our team is currently reviewing your details. We usually reply within 24-48 hours with specific information valid for your country (${country}).</p>
      <p>In the meantime, feel free to browse our FAQ section.</p>
      <br/>
      <p>Best regards,</p>
      <p><strong>Workers United Team</strong></p>
      <p><a href="https://www.workersunited.eu">www.workersunited.eu</a></p>
    </body></html>`;
    sendSmtpEmailToUser.sender = { "name": "Workers United", "email": "contact@workersunited.eu" };
    sendSmtpEmailToUser.to = [{ "email": email, "name": name }];

    await apiInstance.sendTransacEmail(sendSmtpEmailToUser);

    // Success response
    return res.status(200).json({ success: true, message: 'Message sent successfully' });

  } catch (error) {
    console.error('Brevo Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to send email' });
  }
};
