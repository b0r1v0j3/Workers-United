// Notification utilities for email and dashboard alerts
import { sendEmail } from "@/lib/mailer";

interface OfferNotificationData {
  candidateEmail: string;
  candidateName: string;
  jobTitle: string;
  companyName: string;
  country: string;
  expiresAt: string;
  offerId: string;
}

interface OfferExpiredData {
  candidateEmail: string;
  candidateName: string;
  jobTitle: string;
  queuePosition: number;
}

export async function sendOfferNotification(data: OfferNotificationData): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const paymentUrl = `${baseUrl}/profile/offers/${data.offerId}`;

  const expiryDate = new Date(data.expiresAt);
  const formattedExpiry = expiryDate.toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  const emailSubject = `🎉 Job Offer: ${data.jobTitle} - Action Required in 24 Hours`;
  const emailBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #1E3A5F 0%, #2563EB 100%); padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0;">🎉 Congratulations!</h1>
        <p style="color: rgba(255,255,255,0.9); margin-top: 10px;">You have a job offer!</p>
      </div>
      
      <div style="padding: 30px; background: #f9fafb;">
        <p>Dear ${data.candidateName},</p>
        
        <p>Great news! You have been matched with a job opportunity:</p>
        
        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563EB;">
          <p style="margin: 0;"><strong>Position:</strong> ${data.jobTitle}</p>
          <p style="margin: 10px 0 0;"><strong>Company:</strong> ${data.companyName}</p>
          <p style="margin: 10px 0 0;"><strong>Location:</strong> ${data.country}</p>
        </div>
        
        <div style="background: #FEF3C7; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #92400E;">
            <strong>⏰ IMPORTANT:</strong> You have exactly <strong>24 hours</strong> to confirm this offer.
          </p>
          <p style="margin: 10px 0 0; color: #92400E;">
            Offer expires: ${formattedExpiry}
          </p>
        </div>
        
        <p><strong>Confirmation fee:</strong> $190 USD</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${paymentUrl}" 
             style="background: linear-gradient(135deg, #1E3A5F 0%, #2563EB 100%); 
                    color: white; 
                    padding: 15px 30px; 
                    text-decoration: none; 
                    border-radius: 8px; 
                    font-weight: bold;
                    display: inline-block;">
            CONFIRM NOW →
          </a>
        </div>
        
        <p style="color: #6B7280; font-size: 14px;">
          If you do not confirm within 24 hours, this offer will be automatically 
          transferred to the next worker in the queue.
        </p>
        
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
        
        <p style="color: #6B7280; font-size: 12px; text-align: center;">
          Workers United - Legal International Hiring<br>
          Questions? Reply to this email.
        </p>
      </div>
    </div>
  `;

  try {
    const result = await sendEmail(data.candidateEmail, emailSubject, emailBody);
    if (result.success) {
      console.log(`✅ Offer notification sent to ${data.candidateEmail}`);
    } else {
      console.error(`❌ Failed to send offer notification: ${result.error}`);
    }
  } catch (err) {
    console.error("Offer notification error:", err);
  }
}

export async function sendOfferExpiredNotification(data: OfferExpiredData): Promise<void> {
  const emailSubject = `⚠️ Your job offer has expired - ${data.jobTitle}`;
  const emailBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #FEF3C7; padding: 30px; text-align: center;">
        <h1 style="color: #92400E; margin: 0;">⚠️ Offer Expired</h1>
      </div>
      
      <div style="padding: 30px; background: #f9fafb;">
        <p>Dear ${data.candidateName},</p>
        
        <p>Unfortunately, your offer for <strong>${data.jobTitle}</strong> has expired 
        because the confirmation fee was not paid within 24 hours.</p>
        
        <p>The position has been offered to the next worker in the queue.</p>
        
        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563EB;">
          <p style="margin: 0;"><strong>Don't worry!</strong></p>
          <p style="margin: 10px 0 0;">You remain in the queue and will be notified when the next matching opportunity becomes available.</p>
          <p style="margin: 10px 0 0;"><strong>Your current queue position:</strong> #${data.queuePosition}</p>
        </div>
        
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
        
        <p style="color: #6B7280; font-size: 12px; text-align: center;">
          Workers United - Legal International Hiring
        </p>
      </div>
    </div>
  `;

  try {
    const result = await sendEmail(data.candidateEmail, emailSubject, emailBody);
    if (result.success) {
      console.log(`✅ Offer expired notification sent to ${data.candidateEmail}`);
    } else {
      console.error(`❌ Failed to send expired notification: ${result.error}`);
    }
  } catch (err) {
    console.error("Offer expired notification error:", err);
  }
}

export async function sendQueueJoinedNotification(data: {
  candidateEmail: string;
  candidateName: string;
  queuePosition: number;
}): Promise<void> {
  const emailSubject = "🎯 You're in the queue! Job search started";
  const emailBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #1E3A5F 0%, #2563EB 100%); padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0;">🎯 You're In!</h1>
        <p style="color: rgba(255,255,255,0.9); margin-top: 10px;">Your job search has started</p>
      </div>
      
      <div style="padding: 30px; background: #f9fafb;">
        <p>Dear ${data.candidateName},</p>
        
        <p>Your payment has been confirmed and you're now active in our job matching queue!</p>
        
        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10B981; text-align: center;">
          <p style="margin: 0; font-size: 14px; color: #6B7280;">Your queue position</p>
          <p style="margin: 10px 0 0; font-size: 36px; font-weight: bold; color: #1E3A5F;">#${data.queuePosition}</p>
        </div>
        
        <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #166534;"><strong>What happens next:</strong></p>
          <ul style="margin: 10px 0 0; padding-left: 20px; color: #166534;">
            <li>We match your profile with employer requests</li>
            <li>You'll receive a notification when matched</li>
            <li>Accept within 24 hours to secure the position</li>
          </ul>
        </div>
        
        <p style="color: #6B7280; font-size: 14px;">
          <strong>90-Day Guarantee:</strong> If we don't find you a job within 90 days, you'll get a full refund.
        </p>
        
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
        
        <p style="color: #6B7280; font-size: 12px; text-align: center;">
          Workers United - Legal International Hiring<br>
          Questions? Reply to this email.
        </p>
      </div>
    </div>
  `;

  try {
    const result = await sendEmail(data.candidateEmail, emailSubject, emailBody);
    if (result.success) {
      console.log(`✅ Queue joined notification sent to ${data.candidateEmail}`);
    } else {
      console.error(`❌ Failed to send queue notification: ${result.error}`);
    }
  } catch (err) {
    console.error("Queue joined notification error:", err);
  }
}
