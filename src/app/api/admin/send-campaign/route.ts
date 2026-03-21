import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { queueEmail } from "@/lib/email-templates";
import { isEmailDeliveryAccepted } from "@/lib/email-queue";
import { normalizeUserType } from "@/lib/domain";
import { isGodModeUser } from "@/lib/godmode";

type OutreachRecipient = {
  id: string;
  company_name: string | null;
  email: string | null;
  status: string | null;
};

const DEFAULT_LANGUAGE = "sr";
const SEND_DELAY_MS = 300;

function normalizeCampaignLanguage(value: unknown): "sr" | "en" {
  return value === "en" ? "en" : DEFAULT_LANGUAGE;
}

function classifyCampaignFailureStatus(errorMessage: string | null | undefined) {
  const message = (errorMessage || "").toLowerCase();
  const invalidEmailPatterns = [
    "invalid",
    "mailbox unavailable",
    "no such user",
    "recipient address rejected",
    "badly formatted",
    "address syntax",
  ];

  return invalidEmailPatterns.some((pattern) => message.includes(pattern))
    ? "email_invalid"
    : null;
}

async function requireAdminAccess() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_type")
    .eq("id", user.id)
    .single();

  const profileType = normalizeUserType(profile?.user_type);
  const metadataType = normalizeUserType(user.user_metadata?.user_type);

  if (profileType !== "admin" && metadataType !== "admin" && !isGodModeUser(user.email)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { user };
}

function hasDeliverableEmail(recipient: OutreachRecipient): recipient is OutreachRecipient & { email: string } {
  return typeof recipient.email === "string" && recipient.email.trim().length > 3;
}

function dedupeRecipientsByEmail(recipients: Array<OutreachRecipient & { email: string }>) {
  return Array.from(
    new Map(
      recipients.map((recipient) => [
        recipient.email.trim().toLowerCase(),
        {
          ...recipient,
          email: recipient.email.trim().toLowerCase(),
          company_name: recipient.company_name?.trim() || null,
        },
      ]),
    ).values(),
  );
}

export async function POST(req: NextRequest) {
  try {
    const access = await requireAdminAccess();
    if ("error" in access) {
      return access.error;
    }

    const body = await req.json();
    const campaign = typeof body.campaign === "string" ? body.campaign.trim() : "";
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const language = normalizeCampaignLanguage(body.language);
    const statusFilter = typeof body.status_filter === "string" ? body.status_filter.trim() : "delivered";
    const dryRun = body.dry_run === true;

    if (!campaign || !subject) {
      return NextResponse.json({ error: "campaign and subject are required" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: recipients, error } = await admin
      .from("outreach_campaigns")
      .select("id, company_name, email, status")
      .eq("campaign", campaign)
      .eq("status", statusFilter);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const eligibleRecipients = dedupeRecipientsByEmail((recipients || []).filter(hasDeliverableEmail));

    if (eligibleRecipients.length === 0) {
      return NextResponse.json({ message: "No recipients found", count: 0 });
    }

    if (dryRun) {
      return NextResponse.json({
        dry_run: true,
        count: eligibleRecipients.length,
        sample: eligibleRecipients.slice(0, 3).map((recipient) => ({
          company: recipient.company_name,
          email: recipient.email,
        })),
      });
    }

    let sent = 0;
    let queued = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const recipient of eligibleRecipients) {
      const recipientName = recipient.company_name?.trim() || "Employer";
      const result = await queueEmail(
        admin,
        null,
        "employer_outreach",
        recipient.email,
        recipientName,
        {
          name: recipientName,
          companyName: recipientName,
          subject,
          campaignLanguage: language,
          recipientRole: "employer",
        },
      );

      const nextStatus = result.sent ? "delivered" : classifyCampaignFailureStatus(result.error);
      const updatePayload: { status?: string; sent_at?: string | null } = {};

      if (result.sent) {
        updatePayload.status = "delivered";
        updatePayload.sent_at = new Date().toISOString();
      } else if (nextStatus === "email_invalid") {
        updatePayload.status = "email_invalid";
        updatePayload.sent_at = null;
      }

      let updateError: { message: string } | null = null;
      if (Object.keys(updatePayload).length > 0) {
        const updateResult = await admin
          .from("outreach_campaigns")
          .update(updatePayload)
          .eq("id", recipient.id);
        updateError = updateResult.error;
      }

      if (updateError) {
        failed++;
        errors.push(`${recipientName}: ${updateError.message}`);
      } else if (result.sent) {
        sent++;
      } else if (isEmailDeliveryAccepted(result)) {
        queued++;
      } else {
        failed++;
        errors.push(`${recipientName}: ${result.error || "Campaign email failed"}`);
      }

      await new Promise((resolve) => setTimeout(resolve, SEND_DELAY_MS));
    }

    return NextResponse.json({ sent, queued, failed, errors: errors.slice(0, 10) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
