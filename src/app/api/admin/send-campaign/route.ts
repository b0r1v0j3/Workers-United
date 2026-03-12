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
      intro: `Moje ime je Borivoje Stojković, osnivač platforme <strong>Workers United</strong>. Kontaktiram Vas jer verujemo da možemo biti pravi partner za Vašu kompaniju <strong>${companyName}</strong> u oblasti zapošljavanja stranih radnika.`,
      problemTitle: `Zašto Workers United?`,
      problem: `Pronalaženje pouzdanih stranih radnika je komplikovano — vize, dozvole za rad, ugovori, ambasade. Mi smo to rešili za Vas.`,
      offerTitle: `Šta dobijate — potpuno besplatno:`,
      items: [
        { icon: "👷", text: `<strong>Verifikovani radnici</strong> — vozači, građevinci, fabrika, ugostiteljstvo, čišćenje, logistika` },
        { icon: "📋", text: `<strong>Kompletna administracija</strong> — vize, radne dozvole, ugovori, ambasade — sve mi rešavamo` },
        { icon: "✈️", text: `<strong>Doček na aerodromu</strong> i podrška pri dolasku u Srbiju` },
        { icon: "🔄", text: `<strong>Produženje boravišnih dozvola</strong> — brinemo o svemu tokom trajanja radnog odnosa` },
        { icon: "💰", text: `<strong>Nema troškova za poslodavca</strong> — naknadu plaća radnik, ne Vi` },
      ],
      statsTitle: `Naši rezultati:`,
      stats: [
        { number: "194+", label: "Verifikovanih radnika" },
        { number: "11", label: "Plasmana u januaru 2026." },
        { number: "100%", label: "Legalni ugovori" },
      ],
      ctaTitle: `Registrujte se besplatno i pregledajte profile radnika`,
      cta: `Registrujte se →`,
      ctaUrl: `https://workersunited.eu/signup`,
      orContact: `ili nas kontaktirajte direktno:`,
      phone: `+381 69 123 4567`,
      email: `contact@workersunited.eu`,
      whatsapp: `WhatsApp`,
      whatsappUrl: `https://wa.me/15557839521`,
      signoff: `Srdačan pozdrav,`,
      name: `Borivoje Stojković`,
      title: `Osnivač, Workers United`,
      unsubscribe: `Ako ne želite više da primate naše poruke, odjavite se ovde.`,
      unsubscribeUrl: `https://workersunited.eu/unsubscribe`,
      legal: `Workers United · workersunited.eu · Beograd, Srbija`,
    },
    en: {
      preheader: `Free worker placement services for ${companyName}`,
      greeting: `Dear Sir/Madam,`,
      intro: `My name is Borivoje Stojković, founder of <strong>Workers United</strong>. I'm reaching out because we believe we can be the right partner for <strong>${companyName}</strong> in hiring foreign workers.`,
      problemTitle: `Why Workers United?`,
      problem: `Finding reliable foreign workers is complex — visas, work permits, contracts, embassies. We've solved all of that for you.`,
      offerTitle: `What you get — completely free:`,
      items: [
        { icon: "👷", text: `<strong>Verified workers</strong> — drivers, construction, factory, hospitality, cleaning, logistics` },
        { icon: "📋", text: `<strong>Full administration</strong> — visas, work permits, contracts, embassies — we handle everything` },
        { icon: "✈️", text: `<strong>Airport pickup</strong> and arrival support` },
        { icon: "🔄", text: `<strong>Residence permit renewals</strong> — we take care of everything during employment` },
        { icon: "💰", text: `<strong>No cost for the employer</strong> — the worker pays the fee, not you` },
      ],
      statsTitle: `Our results:`,
      stats: [
        { number: "194+", label: "Verified workers" },
        { number: "11", label: "Placements in Jan 2026" },
        { number: "100%", label: "Legal contracts" },
      ],
      ctaTitle: `Register for free and browse worker profiles`,
      cta: `Register now →`,
      ctaUrl: `https://workersunited.eu/signup`,
      orContact: `or contact us directly:`,
      phone: `+381 69 123 4567`,
      email: `contact@workersunited.eu`,
      whatsapp: `WhatsApp`,
      whatsappUrl: `https://wa.me/15557839521`,
      signoff: `Best regards,`,
      name: `Borivoje Stojković`,
      title: `Founder, Workers United`,
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
            <td style="background:linear-gradient(135deg,#0f0f0f 0%,#1a1a2e 100%);padding:32px 40px;text-align:center;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <!-- Logo text -->
                    <div style="display:inline-block;border:2px solid rgba(255,255,255,0.15);border-radius:10px;padding:10px 24px;margin-bottom:16px;">
                      <span style="color:#ffffff;font-size:24px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">WORKERS</span>
                      <span style="color:#4ade80;font-size:24px;font-weight:300;letter-spacing:2px;text-transform:uppercase;"> UNITED</span>
                    </div>
                    <p style="margin:0;color:rgba(255,255,255,0.6);font-size:13px;letter-spacing:1px;text-transform:uppercase;">workersunited.eu</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ===== HERO BANNER ===== -->
          <tr>
            <td style="background:linear-gradient(135deg,#16a34a 0%,#15803d 100%);padding:28px 40px;text-align:center;">
              <p style="margin:0;color:#ffffff;font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;opacity:0.85;">Besplatna usluga za poslodavce</p>
              <h1 style="margin:8px 0 0;color:#ffffff;font-size:26px;font-weight:800;line-height:1.3;">Strani radnici za Vašu kompaniju —<br/>bez troškova, bez komplikacija</h1>
            </td>
          </tr>

          <!-- ===== BODY ===== -->
          <tr>
            <td class="mobile-pad" style="padding:40px 40px 32px;">

              <!-- Greeting & Intro -->
              <p style="margin:0 0 8px;font-size:17px;font-weight:600;color:#111111;">${t.greeting}</p>
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

              <!-- Stats row -->
              <p style="margin:0 0 16px;font-size:16px;font-weight:700;color:#111111;">${t.statsTitle}</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;border-radius:12px;margin-bottom:32px;overflow:hidden;">
                <tr>
                  ${t.stats.map((stat, i) => `
                  <td class="stat-cell" style="padding:20px 16px;text-align:center;${i < t.stats.length - 1 ? 'border-right:1px solid #e5e7eb;' : ''}">
                    <div style="font-size:28px;font-weight:800;color:#16a34a;line-height:1;">${stat.number}</div>
                    <div style="font-size:12px;color:#6b7280;margin-top:4px;font-weight:500;">${stat.label}</div>
                  </td>`).join("")}
                </tr>
              </table>

              <!-- CTA section -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#f0fdf4 0%,#dcfce7 100%);border-radius:12px;margin-bottom:28px;overflow:hidden;">
                <tr>
                  <td style="padding:28px 32px;text-align:center;">
                    <p style="margin:0 0 20px;font-size:16px;font-weight:600;color:#111111;">${t.ctaTitle}</p>
                    <a href="${t.ctaUrl}" style="display:inline-block;background:#16a34a;color:#ffffff;font-size:16px;font-weight:700;padding:16px 48px;border-radius:50px;text-decoration:none;letter-spacing:0.3px;box-shadow:0 4px 14px rgba(22,163,74,0.35);">${t.cta}</a>
                    <p style="margin:20px 0 0;font-size:14px;color:#6b7280;">${t.orContact}</p>
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:12px auto 0;">
                      <tr>
                        <td style="padding:0 8px;">
                          <a href="tel:${t.phone}" style="display:inline-block;background:#ffffff;border:1px solid #e5e7eb;color:#374151;font-size:13px;font-weight:600;padding:8px 16px;border-radius:8px;text-decoration:none;">📞 ${t.phone}</a>
                        </td>
                        <td style="padding:0 8px;">
                          <a href="${t.whatsappUrl}" style="display:inline-block;background:#25D366;color:#ffffff;font-size:13px;font-weight:600;padding:8px 16px;border-radius:8px;text-decoration:none;">💬 ${t.whatsapp}</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Sign-off -->
              <p style="margin:0 0 4px;font-size:15px;color:#444444;">${t.signoff}</p>
              <p style="margin:0 0 2px;font-size:15px;font-weight:700;color:#111111;">${t.name}</p>
              <p style="margin:0;font-size:13px;color:#6b7280;">${t.title}</p>

            </td>
          </tr>

          <!-- ===== SOCIAL FOOTER ===== -->
          <tr>
            <td style="background:#111111;padding:28px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:16px;">
                    <a href="https://www.facebook.com/workersunited.eu" style="display:inline-block;margin:0 6px;background:rgba(255,255,255,0.1);color:#ffffff;font-size:12px;font-weight:600;padding:7px 14px;border-radius:6px;text-decoration:none;">f Facebook</a>
                    <a href="https://www.instagram.com/workersunited.eu" style="display:inline-block;margin:0 6px;background:rgba(255,255,255,0.1);color:#ffffff;font-size:12px;font-weight:600;padding:7px 14px;border-radius:6px;text-decoration:none;">📸 Instagram</a>
                    <a href="https://www.linkedin.com/company/workers-united-eu" style="display:inline-block;margin:0 6px;background:rgba(255,255,255,0.1);color:#ffffff;font-size:12px;font-weight:600;padding:7px 14px;border-radius:6px;text-decoration:none;">in LinkedIn</a>
                    <a href="${t.whatsappUrl}" style="display:inline-block;margin:0 6px;background:#25D366;color:#ffffff;font-size:12px;font-weight:600;padding:7px 14px;border-radius:6px;text-decoration:none;">💬 WhatsApp</a>
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
