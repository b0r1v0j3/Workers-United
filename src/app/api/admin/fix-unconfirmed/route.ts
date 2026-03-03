import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/mailer";

// One-time admin endpoint to:
// 1. Find all users that were stuck with unconfirmed emails
// 2. Ensure their user_type metadata is set to "worker" 
// 3. Ensure they have a profile record
// 4. Send them a notification email
// Protected by a secret key
export async function POST(request: Request) {
    const { secret } = await request.json();

    if (secret !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // The 24 users we just confirmed
    const targetEmails = [
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
        "suleka31@yahoo.coms",
        "tabishahmed529@gmail.com",
        "suraj_viza@1yahoo.com",
        "mrashid.freelancer@gmail.com",
        "jafarquadri@yahoo.co.in",
        "rameshgharti72@gmail.com",
    ];

    const results: any[] = [];

    // Fetch all auth users
    const { data: { users }, error: listErr } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    if (listErr) {
        return NextResponse.json({ error: listErr.message }, { status: 500 });
    }

    for (const email of targetEmails) {
        const user = users.find(u => u.email === email);
        if (!user) {
            results.push({ email, status: "user_not_found" });
            continue;
        }

        try {
            // 1. Ensure user_type is set to "worker" in metadata
            if (!user.user_metadata?.user_type) {
                await adminClient.auth.admin.updateUserById(user.id, {
                    user_metadata: {
                        ...user.user_metadata,
                        user_type: "worker",
                    },
                });
            }

            // 2. Ensure profile exists
            const { data: existingProfile } = await adminClient
                .from("profiles")
                .select("id")
                .eq("id", user.id)
                .maybeSingle();

            if (!existingProfile) {
                await adminClient.from("profiles").upsert({
                    id: user.id,
                    full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
                    user_type: "worker",
                    avatar_url: user.user_metadata?.avatar_url || null,
                });
            }

            // 3. Ensure candidate record exists
            const { data: existingCandidate } = await adminClient
                .from("candidates")
                .select("id")
                .eq("profile_id", user.id)
                .maybeSingle();

            if (!existingCandidate) {
                await adminClient.from("candidates").insert({
                    profile_id: user.id,
                    status: "NEW",
                });
            }

            // 4. Send notification email
            const emailHtml = buildNotificationEmail();
            const emailResult = await sendEmail(
                email,
                "Important: Your Account is Verified",
                emailHtml
            );

            results.push({
                email,
                userId: user.id,
                status: "success",
                metadataFixed: !user.user_metadata?.user_type,
                profileCreated: !existingProfile,
                candidateCreated: !existingCandidate,
                emailSent: emailResult.success,
                emailError: emailResult.error || null,
            });
        } catch (err: any) {
            results.push({ email, status: "error", error: err.message });
        }
    }

    return NextResponse.json({
        total: targetEmails.length,
        results,
    });
}

function buildNotificationEmail() {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Account is Verified</title>
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0; padding:0; background-color:#F5F5F7; font-family: 'Montserrat', sans-serif; color: #334155; line-height: 1.6;">
    <div style="display:none; max-height:0; overflow:hidden;">Your email is now confirmed — log in and get started!&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>
    <div style="max-width:600px; margin: 40px auto; padding: 0 15px;">
        <div style="background:white; border-radius:24px; overflow: hidden; border: 1px solid #E5E5EA;">
            <div style="background: #FFFFFF; padding: 40px 40px 30px; text-align: center; border-bottom: 1px solid #E5E5EA;">
                 <img src="https://www.workersunited.eu/logo-wordmark.png" alt="Workers United" width="160" height="auto" style="vertical-align: middle; display: block; margin: 0 auto;">
            </div>
            
            <div style="padding: 40px; text-align: center;">
                <img src="https://img.icons8.com/ios/100/000000/checked.png" width="80" height="80" alt="Verified" style="margin-bottom: 20px;">
                <h1 style="color:#1D1D1F; font-size: 26px; font-weight: 700; margin: 0 0 10px;">Account Verified</h1>
                
                <p style="color: #1D1D1F; font-size: 16px; margin: 30px 0;">
                    We apologize for the trouble with the email confirmation.<br><br>
                    <strong>Your email address has been successfully verified on our end.</strong>
                </p>
                
                <p style="color: #515154; font-size: 15px; margin-bottom: 30px;">
                    You can now log in to your account and continue setting up your profile so we can match you with an employer in Europe!
                </p>
                
                <div style="text-align:center; margin-top:35px;">
                    <a href="https://workersunited.eu/login" style="display: inline-block; background: #111111; color: #ffffff !important; padding: 14px 32px; border-radius: 9999px; text-decoration: none; font-weight: 600; font-size: 16px;">
                        Log In Now
                    </a>
                </div>
            </div>
        </div>
        
        <div style="text-align:center; margin-top:40px; margin-bottom: 40px; color:#94a3b8; font-size:13px;">
            <p style="margin-bottom:20px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; font-size: 11px;">Stay connected</p>
            <div style="margin-bottom:30px;">
                <a href="https://www.facebook.com/profile.php?id=61585104076725" style="text-decoration:none; margin:0 4px; opacity: 0.8;"><img src="https://img.icons8.com/fluency/48/facebook-new.png" width="28" height="28" alt="Facebook"></a>
                <a href="https://www.instagram.com/workersunited.eu/" style="text-decoration:none; margin:0 4px; opacity: 0.8;"><img src="https://img.icons8.com/fluency/48/instagram-new.png" width="28" height="28" alt="Instagram"></a>
                <a href="https://wa.me/15557839521" style="text-decoration:none; margin:0 4px; opacity: 0.8;"><img src="https://img.icons8.com/fluency/48/whatsapp.png" width="28" height="28" alt="WhatsApp"></a>
            </div>
            <p style="margin:0 0 8px;">&copy; ${new Date().getFullYear()} Workers United LLC</p>
            <p style="margin:0 0 20px;">75 E 3rd St., Sheridan, Wyoming 82801</p>
        </div>
    </div>
</body>
</html>`;
}
