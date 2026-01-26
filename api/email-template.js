export const getEmailTemplate = (title, bodyContent) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f7; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
    .container { width: 100%; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
    .header { background-color: #2563eb; padding: 30px; text-align: center; }
    .logo { max-width: 150px; height: auto; }
    .content { padding: 40px 30px; color: #333333; line-height: 1.6; font-size: 16px; }
    .footer { background-color: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #999999; border-top: 1px solid #eeeeee; }
    h1 { color: #111827; font-size: 22px; margin-top: 0; margin-bottom: 20px; }
    p { margin-bottom: 15px; }
    .btn { display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 10px; }
    .btn:hover { background-color: #1d4ed8; }
    .info-box { background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0; font-size: 14px; }
  </style>
</head>
<body>
  <div style="padding: 40px 0;">
    <div class="container">
      <div class="header">
        <!-- Using the deployed URL for the logo -->
        <img src="https://workersunited.eu/assets/logo-email.png" alt="Workers United" class="logo" style="filter: brightness(0) invert(1);">
      </div>
      <div class="content">
        ${bodyContent}
      </div>
      <div class="footer">
        <p>&copy; ${new Date().getFullYear()} Workers United LLC. All rights reserved.</p>
        <p>Legal International Hiring & Work Visa Support</p>
        <p><a href="https://workersunited.eu" style="color: #2563eb; text-decoration: none;">www.workersunited.eu</a></p>
      </div>
    </div>
  </div>
</body>
</html>
`;
