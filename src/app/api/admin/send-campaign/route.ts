import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/mailer";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function buildCampaignHtml(companyName: string, language: string = "sr"): string {
  const content = {
    sr: {
      preheader: `Besplatno posredovanje pri zapošljavanju stranih radnika za ${companyName}`,
      greeting: `Poštovani,`,
      intro: `Kontaktiram Vas jer verujemo da možemo biti pravi partneri za Vašu kompaniju u oblasti zapošljavanja stranih radnika.`,
      problemTitle: `Zašto Workers United?`,
      problem: `Pronalaženje pouzdanih stranih radnika je komplikovano — vize, dozvole za rad, ugovori, ambasade. Mi smo to rešili za Vas.`,
      offerTitle: `Šta dobijate — potpuno besplatno:`,
      items: [
        { icon: "👷", text: `<strong>Verifikovani radnici</strong> — vozači, građevinci, fabrika, ugostiteljstvo, čišćenje, logistika` },
        { icon: "📋", text: `<strong>Kompletna administracija</strong> — vize, radne dozvole, ugovori, ambasade — sve mi rešavamo` },
        { icon: "✈️", text: `<strong>Doček na aerodromu</strong> i podrška pri dolasku u Srbiju` },
        { icon: "🔄", text: `<strong>Produženje boravišnih dozvola</strong> — brinemo o svemu tokom trajanja radnog odnosa` },
        { icon: "💰", text: `<strong>Nema troškova za poslodavca</strong>` },
      ],
      ctaTitle: `Registrujte se potpuno besplatno i postavite oglas za posao`,
      cta: `Registrujte se →`,
      ctaUrl: `https://workersunited.eu/signup`,
      signoff: `Srdačan pozdrav,`,
      name: `Workers United`,
      title: `workersunited.eu`,
      unsubscribe: `Ako ne želite više da primate naše poruke, odjavite se ovde.`,
      unsubscribeUrl: `https://workersunited.eu/unsubscribe`,
      legal: `Workers United · workersunited.eu · Beograd, Srbija`,
    },
    en: {
      preheader: `Free worker placement services for ${companyName}`,
      greeting: `Dear Sir/Madam,`,
      intro: `We are reaching out because we believe we can be the right partner for your company in hiring foreign workers.`,
      problemTitle: `Why Workers United?`,
      problem: `Finding reliable foreign workers is complex — visas, work permits, contracts, embassies. We've solved all of that for you.`,
      offerTitle: `What you get — completely free:`,
      items: [
        { icon: "👷", text: `<strong>Verified workers</strong> — drivers, construction, factory, hospitality, cleaning, logistics` },
        { icon: "📋", text: `<strong>Full administration</strong> — visas, work permits, contracts, embassies — we handle everything` },
        { icon: "✈️", text: `<strong>Airport pickup</strong> and arrival support` },
        { icon: "🔄", text: `<strong>Residence permit renewals</strong> — we take care of everything during employment` },
        { icon: "💰", text: `<strong>No cost for the employer</strong>` },
      ],
      ctaTitle: `Register for free and post a job listing`,
      cta: `Register now →`,
      ctaUrl: `https://workersunited.eu/signup`,
      signoff: `Best regards,`,
      name: `Workers United`,
      title: `workersunited.eu`,
      unsubscribe: `If you no longer wish to receive our messages, unsubscribe here.`,
      unsubscribeUrl: `https://workersunited.eu/unsubscribe`,
      legal: `Workers United · workersunited.eu · Belgrade, Serbia`,
    },
  };

  const t = content[language as keyof typeof content] || content.sr;

  return `<!DOCTYPE html>
<html lang="${language}" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>Workers United</title>
  <!--[if mso]>
  <noscript>
    <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  </noscript>
  <![endif]-->
  <style>
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; }
      .stat-cell { display: block !important; width: 100% !important; text-align: center !important; padding: 8px 0 !important; }
      .mobile-pad { padding: 24px 20px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">

  <!-- Preheader (hidden) -->
  <div style="display:none;font-size:1px;color:#f0f2f5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${t.preheader}</div>

  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f2f5;padding:40px 16px;">
    <tr>
      <td align="center">

        <!-- Email container -->
        <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

          <!-- ===== HEADER ===== -->
          <tr>
            <td style="background:#111111;padding:20px 40px 14px;text-align:center;">
              <img src="https://workersunited.eu/logo-complete-transparent.png" alt="Workers United" height="48" style="display:block;margin:0 auto 10px;filter:invert(1);" />
              <a href="https://www.workersunited.eu" style="display:inline-block;color:#9ca3af;font-size:12px;text-decoration:none;letter-spacing:0.3px;border-bottom:1px solid rgba(156,163,175,0.3);padding-bottom:1px;">www.workersunited.eu</a>
            </td>
          </tr>

          <!-- ===== HERO BANNER ===== -->
          <tr>
            <td style="background:linear-gradient(135deg,#16a34a 0%,#15803d 100%);padding:28px 40px;text-align:center;">
              <p style="margin:0;color:#ffffff;font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;opacity:0.85;">Besplatna usluga za poslodavce</p>
              <h1 style="margin:8px 0 0;color:#ffffff;font-size:26px;font-weight:800;line-height:1.3;">Strani radnici za Vašu kompaniju<br/>bez troškova i komplikacija</h1>
            </td>
          </tr>

          <!-- ===== BODY ===== -->
          <tr>
            <td class="mobile-pad" style="padding:40px 40px 32px;">

              <!-- Greeting & Intro -->
              <p style="margin:0 0 16px;font-size:17px;font-weight:600;color:#111111;">${t.greeting}</p>
              <p style="margin:0 0 28px;font-size:15px;color:#444444;line-height:1.7;">${t.intro}</p>

              <!-- Problem section -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fffe;border-left:4px solid #16a34a;border-radius:0 8px 8px 0;margin-bottom:28px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:0.5px;">${t.problemTitle}</p>
                    <p style="margin:0;font-size:15px;color:#333333;line-height:1.6;">${t.problem}</p>
                  </td>
                </tr>
              </table>

              <!-- Offer list -->
              <p style="margin:0 0 16px;font-size:16px;font-weight:700;color:#111111;">${t.offerTitle}</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                ${t.items.map(item => `
                <tr>
                  <td style="padding:10px 0;vertical-align:top;width:36px;">
                    <div style="width:32px;height:32px;background:#f0fdf4;border-radius:8px;text-align:center;line-height:32px;font-size:16px;">${item.icon}</div>
                  </td>
                  <td style="padding:10px 0 10px 12px;font-size:15px;color:#333333;line-height:1.6;vertical-align:middle;">${item.text}</td>
                </tr>
                <tr><td colspan="2" style="height:1px;background:#f3f4f6;"></td></tr>`).join("")}
              </table>



              <!-- CTA section -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#f0fdf4 0%,#dcfce7 100%);border-radius:12px;margin-bottom:28px;overflow:hidden;">
                <tr>
                  <td style="padding:28px 32px;text-align:center;">
                    <p style="margin:0 0 20px;font-size:16px;font-weight:600;color:#111111;">${t.ctaTitle}</p>
                    <a href="${t.ctaUrl}" style="display:inline-block;background:#16a34a;color:#ffffff;font-size:16px;font-weight:700;padding:16px 48px;border-radius:50px;text-decoration:none;letter-spacing:0.3px;box-shadow:0 4px 14px rgba(22,163,74,0.35);">${t.cta}</a>
                  </td>
                </tr>
              </table>

              <!-- Sign-off -->
              <p style="margin:0 0 6px;font-size:15px;color:#444444;">${t.signoff}</p>
              <p style="margin:0 0 2px;font-size:16px;font-weight:800;color:#111111;">${t.name}</p>
              <p style="margin:0;font-size:13px;color:#16a34a;">${t.title}</p>

            </td>
          </tr>

          <!-- ===== SOCIAL FOOTER ===== -->
          <tr>
            <td style="background:#111111;padding:28px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:16px;">
                    <a href="https://www.facebook.com/workersunited.eu" style="display:inline-flex;align-items:center;gap:6px;margin:0 4px;background:rgba(255,255,255,0.08);color:#e5e7eb;font-size:12px;font-weight:600;padding:8px 14px;border-radius:8px;text-decoration:none;border:1px solid rgba(255,255,255,0.12);vertical-align:middle;"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.791-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.97h-1.513c-1.491 0-1.956.93-1.956 1.883v2.273h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg>Facebook</a>
                    <a href="https://www.instagram.com/workersunited.eu" style="display:inline-flex;align-items:center;gap:6px;margin:0 4px;background:rgba(255,255,255,0.08);color:#e5e7eb;font-size:12px;font-weight:600;padding:8px 14px;border-radius:8px;text-decoration:none;border:1px solid rgba(255,255,255,0.12);vertical-align:middle;"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>Instagram</a>
                    <a href="https://www.threads.net/@workersunited.eu" style="display:inline-flex;align-items:center;gap:6px;margin:0 4px;background:rgba(255,255,255,0.08);color:#e5e7eb;font-size:12px;font-weight:600;padding:8px 14px;border-radius:8px;text-decoration:none;border:1px solid rgba(255,255,255,0.12);vertical-align:middle;"><svg width="14" height="14" viewBox="0 0 192 192" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M141.537 88.988a66.667 66.667 0 00-2.518-1.143c-1.482-27.307-16.403-42.94-41.457-43.1h-.34c-14.986 0-27.449 6.396-35.12 18.036l13.779 9.452c5.73-8.695 14.724-10.548 21.348-10.548h.229c8.249.053 14.474 2.452 18.503 7.129 2.932 3.405 4.893 8.111 5.864 14.05-7.314-1.243-15.224-1.626-23.68-1.14-23.82 1.371-39.134 15.264-38.105 34.568.522 9.792 5.4 18.216 13.735 23.719 7.047 4.652 16.124 6.927 25.557 6.412 12.458-.683 22.231-5.436 29.049-14.127 5.178-6.6 8.453-15.153 9.899-25.93 5.937 3.583 10.337 8.298 12.767 13.966 4.132 9.635 4.373 25.468-8.546 38.376-11.319 11.308-24.925 16.2-45.488 16.351-22.809-.169-40.06-7.484-51.275-21.742C35.236 139.966 29.808 120.682 29.605 96c.203-24.682 5.63-43.966 16.133-57.317C56.954 24.425 74.206 17.11 97.015 16.94c22.975.17 40.526 7.52 52.171 21.847 5.71 7.026 10.015 15.86 12.853 26.162l16.147-4.308c-3.44-12.68-8.853-23.606-16.219-32.668C147.036 9.607 125.202.195 97.105 0h-.113C68.939.195 47.396 9.642 32.79 28.08 19.884 44.487 13.226 67.316 13.001 96c.225 28.684 6.883 51.514 19.791 67.92 14.606 18.438 36.149 27.885 64.092 28.08h.112c24.96-.173 42.554-6.708 57.048-21.189 18.963-18.945 18.392-42.692 12.142-57.27-4.484-10.454-13.033-18.945-24.65-24.553zM98.44 129.507c-10.44.588-21.286-4.098-21.82-14.135-.397-7.442 5.296-15.746 22.461-16.735 1.966-.113 3.895-.169 5.79-.169 6.235 0 12.068.606 17.371 1.765-1.978 24.702-13.58 28.713-23.802 29.274z"/></svg>Threads</a>
                    <a href="${t.whatsappUrl}" style="display:inline-flex;align-items:center;gap:6px;margin:0 4px;background:#25D366;color:#ffffff;font-size:12px;font-weight:600;padding:8px 14px;border-radius:8px;text-decoration:none;border:1px solid #25D366;vertical-align:middle;"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>WhatsApp</a>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <p style="margin:0 0 8px;font-size:11px;color:rgba(255,255,255,0.35);">${t.legal}</p>
                    <a href="${t.unsubscribeUrl}" style="font-size:11px;color:rgba(255,255,255,0.3);text-decoration:underline;">${t.unsubscribe}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!-- End email container -->

      </td>
    </tr>
  </table>

</body>
</html>`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      campaign,
      subject,
      language = "sr",
      status_filter = "delivered",
      dry_run = false,
    } = body;

    if (!campaign || !subject) {
      return NextResponse.json({ error: "campaign and subject are required" }, { status: 400 });
    }

    // Fetch recipients from outreach_campaigns
    let query = supabase
      .from("outreach_campaigns")
      .select("id, company_name, email, industry, city, status")
      .eq("campaign", campaign);

    if (status_filter === "not_contacted") {
      query = query.eq("needs_new_email", true);
    } else if (status_filter === "all") {
      // Send to everyone in the campaign
    } else {
      query = query.eq("status", status_filter);
    }

    const { data: recipients, error: fetchError } = await query;

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!recipients || recipients.length === 0) {
      return NextResponse.json({ message: "No recipients found", sent: 0 });
    }

    if (dry_run) {
      return NextResponse.json({
        dry_run: true,
        would_send: recipients.length,
        recipients: recipients.map(r => ({ email: r.email, company: r.company_name })),
      });
    }

    // Send emails with a small delay to avoid rate limits
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const recipient of recipients) {
      const html = buildCampaignHtml(recipient.company_name, language);
      const result = await sendEmail(recipient.email, subject, html);

      if (result.success) {
        sent++;
        await supabase
          .from("outreach_campaigns")
          .update({ status: "delivered", sent_at: new Date().toISOString(), needs_new_email: false })
          .eq("id", recipient.id);
      } else {
        failed++;
        errors.push(`${recipient.email}: ${result.error}`);
        await supabase
          .from("outreach_campaigns")
          .update({ status: "email_invalid", needs_new_email: true, bounce_reason: result.error?.substring(0, 100) })
          .eq("id", recipient.id);
      }

      // Small delay between emails to avoid Gmail rate limits
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    return NextResponse.json({
      success: true,
      sent,
      failed,
      total: recipients.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  // Preview endpoint - returns campaign stats
  const { searchParams } = new URL(req.url);
  const campaign = searchParams.get("campaign") || "serbia_b2b_march_2026";

  const { data, error } = await supabase
    .from("outreach_campaigns")
    .select("status, needs_new_email")
    .eq("campaign", campaign);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const stats = {
    total: data.length,
    delivered: data.filter(r => r.status === "delivered").length,
    email_invalid: data.filter(r => r.status === "email_invalid").length,
    inbox_full: data.filter(r => r.status === "inbox_full").length,
    needs_new_email: data.filter(r => r.needs_new_email).length,
  };

  return NextResponse.json({ campaign, stats });
}
