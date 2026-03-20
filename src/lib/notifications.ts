// Notification utilities for email, dashboard alerts, and WhatsApp
// All offer-related emails now go through the unified template/queue system.
import type { SupabaseClient } from "@supabase/supabase-js";
import { queueEmail } from "@/lib/email-templates";

interface OfferNotificationData {
  supabase: SupabaseClient;
  workerUserId: string;
  workerEmail: string;
  workerName: string;
  workerPhone?: string;
  jobTitle: string;
  companyName: string;
  country: string;
  expiresAt: string;
  offerId: string;
}

interface OfferExpiredData {
  supabase: SupabaseClient;
  workerUserId: string;
  workerEmail: string;
  workerName: string;
  jobTitle: string;
  queuePosition: number;
}

export async function sendOfferNotification(data: OfferNotificationData): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const offerLink = `${baseUrl}/profile/worker/offers/${data.offerId}`;

  try {
    const emailResult = await queueEmail(
      data.supabase,
      data.workerUserId,
      "job_offer",
      data.workerEmail,
      data.workerName,
      {
        jobTitle: data.jobTitle,
        companyName: data.companyName,
        country: data.country,
        offerLink,
        expiresAt: data.expiresAt,
      },
      undefined,
      data.workerPhone
    );

    if (!emailResult.sent) {
      console.warn("[Notifications] Offer notification queue/send failed:", {
        workerUserId: data.workerUserId,
        workerEmail: data.workerEmail,
        offerId: data.offerId,
        error: emailResult.error || "Unknown email queue failure",
      });
    }
  } catch (err) {
    console.error("Offer notification error:", err);
  }
}

export async function sendOfferExpiredNotification(data: OfferExpiredData): Promise<void> {
  try {
    const emailResult = await queueEmail(
      data.supabase,
      data.workerUserId,
      "offer_expired",
      data.workerEmail,
      data.workerName,
      {
        jobTitle: data.jobTitle,
        queuePosition: data.queuePosition,
      }
    );

    if (!emailResult.sent) {
      console.warn("[Notifications] Offer expired notification queue/send failed:", {
        workerUserId: data.workerUserId,
        workerEmail: data.workerEmail,
        jobTitle: data.jobTitle,
        error: emailResult.error || "Unknown email queue failure",
      });
    }
  } catch (err) {
    console.error("Offer expired notification error:", err);
  }
}
