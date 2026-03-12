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
      greeting: `Poštovani,`,
      body: `Kontaktiramo Vas jer nudimo <strong>besplatno posredovanje pri zapošljavanju stranih radnika</strong> za Vašu kompaniju.`,
      listTitle: `Šta dobijate:`,
      items: [
        `Pristup bazi verifikovanih radnika (vozači, građevinci, fabrika, ugostiteljstvo, čišćenje...)`,
        `Kompletna podrška oko ugovora, viza i ambasada — sve mi rešavamo`,
        `Doček radnika na aerodromu i podrška pri dolasku`,
        `Pomoć oko produženja boravišnih dozvola`,
        `<strong>Bez ikakvih troškova za poslodavca</strong>`,
      ],
      cta: `Registrujte se besplatno`,
      ctaUrl: `https://workersunited.eu/signup`,
      footer: `Za pitanja smo dostupni na contact@workersunited.eu`,
    },
    en: {
      greeting: `Dear Sir/Madam,`,
      body: `We are reaching out to offer <strong>free worker placement services</strong> for your company.`,
      listTitle: `What you get:`,
      items: [
        `Access to a database of verified workers (drivers, construction, factory, hospitality, cleaning...)`,
        `Full support with contracts, visas and embassies — we handle everything`,
        `Airport pickup and arrival support`,
        `Assistance with residence permit extensions`,
        `<strong>No costs for the employer</strong>`,
      ],
      cta: `Register for free`,
      ctaUrl: `https://workersunited.eu/signup`,
      footer: `For questions, contact us at contact@workersunited.eu`,
    },
  };

  const t = content[language as keyof typeof content] || content.sr;

  return `<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Workers United</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:#000000;padding:28px 40px;text-align:center;">
              <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:1px;">WORKERS <span style="font-weight:300;">UNITED</span></span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 20px;font-size:16px;color:#111;">${t.greeting}</p>
              <p style="margin:0 0 24px;font-size:16px;color:#333;line-height:1.6;">${t.body}</p>
              <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#111;">${t.listTitle}</p>
              <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:32px;">
                ${t.items.map(item => `
                <tr>
                  <td style="padding:6px 0;vertical-align:top;">
                    <span style="color:#16a34a;font-size:16px;margin-right:10px;">✓</span>
                  </td>
                  <td style="padding:6px 0;font-size:15px;color:#333;line-height:1.5;">${item}</td>
                </tr>`).join("")}
              </table>
              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:32px;">
                <tr>
                  <td align="center">
                    <a href="${t.ctaUrl}" style="display:inline-block;background:#000000;color:#ffffff;font-size:16px;font-weight:600;padding:16px 40px;border-radius:8px;text-decoration:none;letter-spacing:0.5px;">${t.cta} →</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:14px;color:#666;">${t.footer}</p>
            </td>
          </tr>
          <!-- Social Footer -->
          <tr>
            <td style="background:#f9f9f9;padding:24px 40px;border-top:1px solid #eee;text-align:center;">
              <p style="margin:0 0 12px;font-size:12px;color:#999;">Stay connected</p>
              <a href="https://www.facebook.com/workersunited.eu" style="margin:0 6px;color:#555;font-size:13px;text-decoration:none;">Facebook</a>
              <a href="https://www.instagram.com/workersunited.eu" style="margin:0 6px;color:#555;font-size:13px;text-decoration:none;">Instagram</a>
              <a href="https://www.linkedin.com/company/workers-united-eu" style="margin:0 6px;color:#555;font-size:13px;text-decoration:none;">LinkedIn</a>
              <a href="https://wa.me/15557839521" style="margin:0 6px;color:#555;font-size:13px;text-decoration:none;">WhatsApp</a>
              <p style="margin:16px 0 0;font-size:11px;color:#bbb;">Workers United · workersunited.eu · contact@workersunited.eu</p>
            </td>
          </tr>
        </table>
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
      status_filter = "delivered", // only re-send to delivered, or use 'email_invalid' etc.
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
      // Companies with invalid emails that need new email
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
        // Update status to delivered
        await supabase
          .from("outreach_campaigns")
          .update({ status: "delivered", sent_at: new Date().toISOString(), needs_new_email: false })
          .eq("id", recipient.id);
      } else {
        failed++;
        errors.push(`${recipient.email}: ${result.error}`);
        // Mark as failed
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
