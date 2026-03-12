import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppText, sendWhatsAppTemplate, sendAnnouncement, sendStatusUpdate } from "@/lib/whatsapp";
import { isGodModeUser } from "@/lib/godmode";
import { normalizeUserType } from "@/lib/domain";

const STRIPE_PAYMENT_LINK = process.env.STRIPE_JOB_FINDER_PAYMENT_LINK || "https://buy.stripe.com/fZueVcdG1bglfgr1nc0ZW00";
const CHECKOUT_URL = `${process.env.NEXT_PUBLIC_BASE_URL || "https://workersunited.eu"}/profile/worker/queue`;

export async function POST(req: NextRequest) {
    // ── Auth check ──────────────────────────────────────────────────────────
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase.from("profiles").select("user_type").eq("id", user.id).single();
    const profileType = normalizeUserType(profile?.user_type);
    const metadataType = normalizeUserType(user.user_metadata?.user_type);
    if (profileType !== "admin" && metadataType !== "admin" && !isGodModeUser(user.email)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ── Parse request ────────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;
    const customMessage = body.message as string | undefined;

    // ── Get unpaid workers with phones ───────────────────────────────────────
    const adminSupabase = createAdminClient();
    const { data: workers, error } = await adminSupabase
        .from("worker_onboarding")
        .select("id, phone, profile_id, status")
        .eq("entry_fee_paid", false)
        .not("phone", "is", null)
        .gt("phone", "");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Get profile names
    const profileIds = (workers || []).map(w => w.profile_id).filter(Boolean);
    const { data: profiles } = await adminSupabase
        .from("profiles")
        .select("id, full_name")
        .in("id", profileIds);

    const profileMap = new Map((profiles || []).map(p => [p.id, p.full_name]));

    // Filter valid phones (not test accounts)
    const validWorkers = (workers || []).filter(w =>
        w.phone &&
        w.phone.length > 7 &&
        !w.phone.startsWith("+381600000") // skip test accounts
    );

    // Remove duplicates by phone
    const seen = new Set<string>();
    const uniqueWorkers = validWorkers.filter(w => {
        if (seen.has(w.phone)) return false;
        seen.add(w.phone);
        return true;
    });

    if (dryRun) {
        return NextResponse.json({
            dry_run: true,
            total: uniqueWorkers.length,
            workers: uniqueWorkers.map(w => ({
                phone: w.phone,
                name: profileMap.get(w.profile_id) || "Unknown",
                status: w.status,
            })),
        });
    }

    // ── Send messages ────────────────────────────────────────────────────────
    const results = { sent: [] as string[], failed: [] as { phone: string; name: string; error: string }[] };

    for (const worker of uniqueWorkers) {
        const name = profileMap.get(worker.profile_id) || "";
        const firstName = name.split(" ")[0] || "there";

        // Use announcement template (approved by Meta, works for proactive outbound)
        const title = body.title || "Activate Job Finder";
        const messageBody = customMessage
            ? customMessage.replace("{name}", firstName).replace("{link}", STRIPE_PAYMENT_LINK)
            : `Hi ${firstName}! Your profile is ready. Activate Job Finder for $9 and we'll match you with employers in Europe. 90-day money-back guarantee. Pay: ${STRIPE_PAYMENT_LINK}`;

        try {
            const result = await sendAnnouncement(worker.phone, title, messageBody, "/profile/worker/queue", worker.profile_id);
            if (result.success) {
                results.sent.push(worker.phone);
            } else {
                // Fallback: try status_update template
                const fallback = await sendStatusUpdate(worker.phone, firstName, `Activate Job Finder for $9 — 90-day money-back guarantee. Pay here: ${STRIPE_PAYMENT_LINK}`, worker.profile_id);
                if (fallback.success) {
                    results.sent.push(worker.phone);
                } else {
                    results.failed.push({ phone: worker.phone, name, error: result.error || "Unknown error" });
                }
            }
        } catch (err: any) {
            results.failed.push({ phone: worker.phone, name, error: err?.message || "Exception" });
        }

        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 200));
    }

    return NextResponse.json({
        total: uniqueWorkers.length,
        sent: results.sent.length,
        failed: results.failed.length,
        failed_details: results.failed,
        stripe_link: STRIPE_PAYMENT_LINK,
    });
}

export async function GET(req: NextRequest) {
    // ── Auth check ──────────────────────────────────────────────────────────
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase.from("profiles").select("user_type").eq("id", user.id).single();
    const profileType = normalizeUserType(profile?.user_type);
    const metadataType = normalizeUserType(user.user_metadata?.user_type);
    if (profileType !== "admin" && metadataType !== "admin" && !isGodModeUser(user.email)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Return stats
    const adminSupabase = createAdminClient();
    const { data: workers } = await adminSupabase
        .from("worker_onboarding")
        .select("id, phone, status")
        .eq("entry_fee_paid", false)
        .not("phone", "is", null)
        .gt("phone", "");

    const validCount = (workers || []).filter(w =>
        w.phone && w.phone.length > 7 && !w.phone.startsWith("+381600000")
    ).length;

    const { data: paid } = await adminSupabase
        .from("worker_onboarding")
        .select("id")
        .eq("entry_fee_paid", true);

    return NextResponse.json({
        unpaid_with_phone: validCount,
        paid: paid?.length || 0,
        stripe_link: STRIPE_PAYMENT_LINK,
    });
}
