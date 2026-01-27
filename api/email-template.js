export const getEmailTemplate = (title, bodyContent) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f7f9; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
    .container { width: 100%; max-width: 650px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    .header { background-color: #ffffff; padding: 0; text-align: center; border-bottom: 3px solid #2563eb; }
    .logo { width: 100%; max-width: 650px; height: auto; display: block; pointer-events: none; }
    .content { padding: 45px 35px; color: #1f2937; line-height: 1.7; font-size: 16px; }
    .footer { background-color: #f9fafb; padding: 25px; text-align: center; font-size: 13px; color: #6b7280; border-top: 1px solid #e5e7eb; }
    h1 { color: #111827; font-size: 26px; margin-top: 0; margin-bottom: 20px; font-weight: 700; }
    h3 { color: #374151; font-size: 19px; margin-top: 30px; margin-bottom: 15px; font-weight: 600; }
    p { margin-bottom: 16px; color: #374151; }
    ul, ol { margin: 15px 0; padding-left: 25px; color: #374151; }
    li { margin-bottom: 8px; }
    .btn { display: inline-block; background-color: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 15px; transition: background-color 0.3s; }
    .btn:hover { background-color: #1d4ed8; }
    .info-box { background-color: #eff6ff; border-left: 5px solid #2563eb; padding: 18px 20px; margin: 25px 0; font-size: 15px; border-radius: 4px; }
    strong { color: #111827; }
  </style>
</head>
<body>
  <div style="padding: 40px 0;">
    <div class="container">
      <div class="header">
        <!-- Using the final confirmed logo -->
        <img src="https://workersunited.eu/assets/logo-final.jpg" alt="Workers United" class="logo">
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
