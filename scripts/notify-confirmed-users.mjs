// Script to send an update email to the 24 recently confirmed users
import { createTransport } from "nodemailer";
import { readFileSync } from "fs";

const envFile = readFileSync(".env.local", "utf-8");
const env = {};
for (const line of envFile.split("\n")) {
    const clean = line.replace(/\r$/, "");
    const match = clean.match(/^([^#=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim();
}

const transporter = createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // TLS
    auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
    },
});

const emails = [
    "dhivyaa.ramasamy@hrglobalgateway.com",
    "shakeelswat2233@gmail.com",
    "alaskari51214@gmail.com",
    "devilg209@gmail.com",
    "rharoldr5@gmai.com",
    "donsliberato15@gmail.com",
    "gabrieltufanbn@outlook.com",
    "werashanthi@yahoo.com",
    "rt0244183@gmail.com",
    "khanjehangir7777890@gmail.com",
    "lnassim050@gmail.com",
    "omegazi1334@gmai.com",
    "ahmad.zaki6210@gmail.com",
    "chandhu.mtl@gmail.com",
    "stsebastianroyal@gmail.com",
    "abubakarouy@gmail.com",
    "abubakarkawahi@gmail.com",
    "tabishahmed529@gmail.com",
    "suraj_viza@1yahoo.com",
    "mrashid.freelancer@gmail.com",
    "jafarquadri@yahoo.co.in",
    "rameshgharti72@gmail.com"
];

const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Account is Verified</title>
</head>
<body style="margin:0; padding:0; background-color:#F5F5F7; font-family: 'Montserrat', sans-serif; color: #334155; line-height: 1.6; -webkit-font-smoothing: antialiased;">
    <div style="max-width:600px; margin: 40px auto; padding: 0 15px;">
        <div style="background:white; border-radius:24px; overflow: hidden; border: 1px solid #E5E5EA;">
            <div style="background: #FFFFFF; padding: 40px 40px 30px; text-align: center; border-bottom: 1px solid #E5E5EA;">
                 <img src="https://www.workersunited.eu/logo-wordmark.png" alt="Workers United" width="160" height="auto" style="vertical-align: middle; display: block; margin: 0 auto;">
            </div>
            
            <div style="padding: 40px; text-align: center;">
                <img src="https://img.icons8.com/ios/100/000000/checked.png" width="80" height="80" alt="Verified" style="margin-bottom: 20px;">
                <h1 style="color:#1D1D1F; font-size: 26px; font-weight: 700; margin: 0 0 10px;">Account Verified</h1>
                
                <p style="color: #1D1D1F; font-size: 16px; margin: 30px 0;">
                    We fixed the issue with the email confirmation links.<br><br>
                    <strong>Your email address has been successfully verified on our end.</strong>
                </p>
                
                <p style="color: #515154; font-size: 15px; margin-bottom: 30px;">
                    You can now log in to your account and continue setting up your profile so we can match you with an employer in Europe!
                </p>
                
                <div style="text-align:center; margin-top:35px;">
                    <a href="https://workersunited.eu/login" style="display: inline-block; background: #111111; color: #ffffff !important; padding: 14px 32px; border-radius: 9999px; text-decoration: none; font-weight: 600; font-size: 16px; transition: all 0.3s ease;">
                        Log In Now
                    </a>
                </div>
            </div>
        </div>
        
        <div style="text-align:center; margin-top:40px; margin-bottom: 40px; color:#94a3b8; font-size:13px;">
            <p style="margin:0 0 8px;">&copy; ${new Date().getFullYear()} Workers United LLC</p>
            <p style="margin:0 0 20px;">75 E 3rd St., Sheridan, Wyoming 82801</p>
        </div>
    </div>
</body>
</html>
`;

async function main() {
    console.log("Starting email blast...");
    let sent = 0;

    for (const to of emails) {
        try {
            await transporter.sendMail({
                from: '"Workers United" <' + env.SMTP_USER + '>',
                to,
                subject: "Important: Your Account is Verified",
                html
            });
            console.log("✅ Sent to: " + to);
            sent++;
        } catch (err) {
            console.error("❌ Failed to send to " + to + ": " + err.message);
        }

        // Small delay to prevent rate limits
        await new Promise(r => setTimeout(r, 500));
    }

    console.log("\\nDone! Successfully sent " + sent + " emails.");
}

main();
