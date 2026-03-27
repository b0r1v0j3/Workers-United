import { NextResponse } from "next/server";
import { getCronAuthorizationHeader, hasValidCronBearerToken } from "@/lib/cron-auth";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";
import { sendEmail } from "@/lib/mailer";
import { normalizePlatformWebsiteUrl } from "@/lib/platform-contact";
import { evaluateSmoke, SmokeRouteCheck, SmokeServiceCheck } from "@/lib/smoke-evaluator";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const REQUIRED_ROUTES = ["/", "/login", "/signup", "/api/health"];
const CRITICAL_ALERT_COOLDOWN_HOURS = 6;
const ALERT_ACTION = "system_smoke_critical_alert";

interface HealthApiResponse {
    status: "healthy" | "degraded";
    checks: {
        supabase?: { state: string };
        stripe?: { state: string };
        smtp?: { state: string };
        whatsapp?: { state: string };
    };
}

function assertNoError(error: { message: string } | null, context: string): void {
    if (error) {
        throw new Error(`${context}: ${error.message}`);
    }
}

async function insertSystemActivity(
    supabase: ReturnType<typeof createTypedAdminClient>,
    action: string,
    status: "ok" | "error" | "warning",
    details: Record<string, unknown>
): Promise<void> {
    const { error } = await supabase.from("user_activity").insert({
        user_id: null,
        action,
        category: "system",
        status,
        details: details as Json,
    });

    assertNoError(error, `Failed to log ${action}`);
}

function mapService(name: string, state: string | undefined, required: boolean): SmokeServiceCheck {
    if (!state) {
        return { name, state: "down", required };
    }
    if (state === "ok") return { name, state: "ok", required };
    if (state === "not_configured") return { name, state: "not_configured", required };
    if (state === "degraded") return { name, state: "degraded", required };
    return { name, state: "down", required };
}

async function probeRoute(baseUrl: string, path: string): Promise<SmokeRouteCheck> {
    const started = Date.now();
    try {
        const res = await fetch(`${baseUrl}${path}`, {
            method: "GET",
            redirect: "manual",
            signal: AbortSignal.timeout(10000),
        });

        return {
            path,
            status: res.status,
            ok: res.status < 500,
            latencyMs: Date.now() - started,
        };
    } catch (err) {
        return {
            path,
            status: err instanceof Error ? err.message : "unreachable",
            ok: false,
            latencyMs: Date.now() - started,
        };
    }
}

async function shouldSendCriticalAlert(supabase: ReturnType<typeof createTypedAdminClient>): Promise<boolean> {
    const threshold = new Date(Date.now() - CRITICAL_ALERT_COOLDOWN_HOURS * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
        .from("user_activity")
        .select("id")
        .eq("action", ALERT_ACTION)
        .gte("created_at", threshold)
        .order("created_at", { ascending: false })
        .limit(1);

    assertNoError(error, "Failed to evaluate smoke alert cooldown");

    return !data || data.length === 0;
}

export async function GET(request: Request) {
    const authHeader = request.headers.get("authorization");
    if (!hasValidCronBearerToken(authHeader)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const baseUrl = normalizePlatformWebsiteUrl(process.env.NEXT_PUBLIC_BASE_URL);
    const supabase = createTypedAdminClient();
    const started = Date.now();
    const cronAuthHeader = getCronAuthorizationHeader();

    if (!cronAuthHeader) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const healthRes = await fetch(`${baseUrl}/api/health`, {
            headers: { Authorization: cronAuthHeader },
            signal: AbortSignal.timeout(10000),
        });

        const healthJson = (await healthRes.json()) as HealthApiResponse;
        const routeChecks = await Promise.all(REQUIRED_ROUTES.map((path) => probeRoute(baseUrl, path)));

        const serviceChecks: SmokeServiceCheck[] = [
            mapService("supabase", healthJson.checks?.supabase?.state, true),
            mapService("stripe", healthJson.checks?.stripe?.state, true),
            mapService("smtp", healthJson.checks?.smtp?.state, true),
            mapService("whatsapp", healthJson.checks?.whatsapp?.state, false),
        ];

        const evaluation = evaluateSmoke(serviceChecks, routeChecks);
        const durationMs = Date.now() - started;

        await insertSystemActivity(supabase, "system_smoke_check", evaluation.status === "critical" ? "error" : "ok", {
            baseUrl,
            durationMs,
            healthStatus: healthJson.status,
            evaluation,
            routes: routeChecks,
            services: serviceChecks,
        });

        if (evaluation.status === "critical") {
            const ownerEmail = process.env.OWNER_EMAIL || process.env.SMTP_USER;

            if (!ownerEmail) {
                console.error("[system-smoke] Critical alert skipped: missing OWNER_EMAIL and SMTP_USER");
                await insertSystemActivity(supabase, "system_smoke_alert_not_configured", "error", {
                    reason: "Missing OWNER_EMAIL and SMTP_USER",
                    evaluation,
                });
            } else {
                const canAlert = await shouldSendCriticalAlert(supabase);

                if (canAlert) {
                    try {
                        const emailResult = await sendEmail(
                            ownerEmail,
                            "System Smoke Check CRITICAL",
                            `
                            <h2>Workers United Smoke Check Alert</h2>
                            <p><strong>Status:</strong> ${evaluation.status.toUpperCase()}</p>
                            <p><strong>Duration:</strong> ${durationMs}ms</p>
                            <h3>Critical Issues</h3>
                            <ul>${evaluation.criticalIssues.map((issue) => `<li>${issue}</li>`).join("")}</ul>
                            <h3>Warnings</h3>
                            <ul>${evaluation.warnings.map((warning) => `<li>${warning}</li>`).join("")}</ul>
                            <h3>Routes</h3>
                            <pre>${JSON.stringify(routeChecks, null, 2)}</pre>
                            <h3>Services</h3>
                            <pre>${JSON.stringify(serviceChecks, null, 2)}</pre>
                            `
                        );

                        await insertSystemActivity(
                            supabase,
                            ALERT_ACTION,
                            emailResult.success ? "ok" : "warning",
                            {
                                ownerEmail,
                                emailResult,
                                evaluation,
                            }
                        );
                    } catch (emailErr) {
                        await insertSystemActivity(supabase, ALERT_ACTION, "error", {
                            ownerEmail,
                            error: emailErr instanceof Error ? emailErr.message : "Unknown email error",
                            evaluation,
                        });
                    }
                } else {
                    await insertSystemActivity(supabase, "system_smoke_alert_suppressed", "warning", {
                        reason: `Cooldown active (${CRITICAL_ALERT_COOLDOWN_HOURS}h)`,
                        evaluation,
                    });
                }
            }
        }

        return NextResponse.json({
            success: true,
            durationMs,
            evaluation,
            routes: routeChecks,
            services: serviceChecks,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";

        try {
            await insertSystemActivity(supabase, "system_smoke_check", "error", { error: message });
        } catch (logError) {
            console.error("[system-smoke] Failed to log smoke error:", logError);
        }

        return NextResponse.json({ error: message }, { status: 500 });
    }
}
