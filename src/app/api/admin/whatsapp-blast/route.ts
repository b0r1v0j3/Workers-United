import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGodModeUser } from "@/lib/godmode";
import { normalizeUserType } from "@/lib/domain";
import { loadWorkerWhatsAppBlastTargets, sendWorkerWhatsAppBlast } from "@/lib/whatsapp-blast";

async function requireAdminAccess() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    }

    const { data: profile } = await supabase.from("profiles").select("user_type").eq("id", user.id).single();
    const profileType = normalizeUserType(profile?.user_type);
    const metadataType = normalizeUserType(user.user_metadata?.user_type);

    if (profileType !== "admin" && metadataType !== "admin" && !isGodModeUser(user.email)) {
        return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }

    return { user };
}

export async function POST(req: NextRequest) {
    const access = await requireAdminAccess();
    if ("error" in access) {
        return access.error;
    }

    const body = await req.json().catch(() => ({}));
    const admin = createAdminClient();
    const result = await sendWorkerWhatsAppBlast({
        admin,
        actorUserId: access.user.id,
        title: body.title as string | undefined,
        customMessage: body.message as string | undefined,
        dryRun: body.dry_run === true,
    });

    if (body.dry_run === true) {
        return NextResponse.json({
            dry_run: true,
            total: result.total,
            workers: result.targets.map((target) => ({
                phone: target.phone,
                name: target.fullName || "Unknown",
                status: target.status,
            })),
            stripe_link: result.stripeLink,
        });
    }

    return NextResponse.json({
        total: result.total,
        sent: result.sent,
        failed: result.failed,
        failed_details: result.failedDetails,
        stripe_link: result.stripeLink,
    });
}

export async function GET() {
    const access = await requireAdminAccess();
    if ("error" in access) {
        return access.error;
    }

    const admin = createAdminClient();
    const [targets, paidQuery] = await Promise.all([
        loadWorkerWhatsAppBlastTargets(admin),
        admin
            .from("worker_onboarding")
            .select("id", { count: "exact", head: true })
            .eq("entry_fee_paid", true),
    ]);

    return NextResponse.json({
        payment_ready_with_phone: targets.length,
        unpaid_with_phone: targets.length,
        paid: paidQuery.count || 0,
        stripe_link: process.env.STRIPE_JOB_FINDER_PAYMENT_LINK || "https://buy.stripe.com/fZueVcdG1bglfgr1nc0ZW00",
    });
}
