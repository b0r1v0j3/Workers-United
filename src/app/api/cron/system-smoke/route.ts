import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/mailer";
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
        n8n?: { state: string };
    };
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

async function shouldSendCriticalAlert(supabase: ReturnType<typeof createAdminClient>): Promise<boolean> {
    const threshold = new Date(Date.now() - CRITICAL_ALERT_COOLDOWN_HOURS * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
        .from("activity_log")
        .select("id")
        .eq("action", ALERT_ACTION)
        .gte("created_at", threshold)
        .order("created_at", { ascending: false })
        .limit(1);

    if (error) {
        console.warn("[system-smoke] Failed to check alert cooldown:", error.message);
        return true;
    }

    return !data || data.length === 0;
}

export async function GET(request: Request) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://workersunited.eu";
    const supabase = createAdminClient();
    const started = Date.now();

    try {
        const healthRes = await fetch(`${baseUrl}/api/health`, {
            headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
            signal: AbortSignal.timeout(10000),
        });

        const healthJson = (await healthRes.json()) as HealthApiResponse;
        const routeChecks = await Promise.all(REQUIRED_ROUTES.map((p) => probeRoute(baseUrl, p)));

        const serviceChecks: SmokeServiceCheck[] = [
            mapService("supabase", healthJson.checks?.supabase?.state, true),
            mapService("stripe", healthJson.checks?.stripe?.state, true),
            mapService("smtp", healthJson.checks?.smtp?.state, true),
            mapService("whatsapp", healthJson.checks?.whatsapp?.state, false),
            mapService("n8n", healthJson.checks?.n8n?.state, false),
        ];

        const evaluation = evaluateSmoke(serviceChecks, routeChecks);
        const durationMs = Date.now() - started;

        await supabase.from("activity_log").insert({
            user_id: "system",
            action: "system_smoke_check",
            category: "system",
            status: evaluation.status === "critical" ? "error" : "success",
            details: {
                baseUrl,
                durationMs,
                healthStatus: healthJson.status,
                evaluation,
                routes: routeChecks,
                services: serviceChecks,
            },
        });

        if (evaluation.status === "critical") {
            const ownerEmail = process.env.OWNER_EMAIL || "cvetkovicborivoje@gmail.com";
            const canAlert = await shouldSendCriticalAlert(supabase);

            if (canAlert) {
                try {
                    const emailResult = await sendEmail(
                        ownerEmail,
                        "🚨 System Smoke Check CRITICAL",
                        `
                        <h2>Workers United Smoke Check Alert</h2>
                        <p><strong>Status:</strong> ${evaluation.status.toUpperCase()}</p>
                        <p><strong>Duration:</strong> ${durationMs}ms</p>
                        <h3>Critical Issues</h3>
                        <ul>${evaluation.criticalIssues.map((i) => `<li>${i}</li>`).join("")}</ul>
                        <h3>Warnings</h3>
                        <ul>${evaluation.warnings.map((w) => `<li>${w}</li>`).join("")}</ul>
                        <h3>Routes</h3>
                        <pre>${JSON.stringify(routeChecks, null, 2)}</pre>
                        <h3>Services</h3>
                        <pre>${JSON.stringify(serviceChecks, null, 2)}</pre>
                        `
                    );

                    await supabase.from("activity_log").insert({
                        user_id: "system",
                        action: ALERT_ACTION,
                        category: "system",
                        status: emailResult.success ? "success" : "warning",
                        details: {
                            ownerEmail,
                            emailResult,
                            evaluation,
                        },
                    });
                } catch (emailErr) {
                    await supabase.from("activity_log").insert({
                        user_id: "system",
                        action: ALERT_ACTION,
                        category: "system",
                        status: "error",
                        details: {
                            ownerEmail,
                            error: emailErr instanceof Error ? emailErr.message : "Unknown email error",
                            evaluation,
                        },
                    });
                }
            } else {
                await supabase.from("activity_log").insert({
                    user_id: "system",
                    action: "system_smoke_alert_suppressed",
                    category: "system",
                    status: "warning",
                    details: {
                        reason: `Cooldown active (${CRITICAL_ALERT_COOLDOWN_HOURS}h)`,
                        evaluation,
                    },
                });
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
        await supabase.from("activity_log").insert({
            user_id: "system",
            action: "system_smoke_check",
            category: "system",
            status: "error",
            details: { error: message },
        });

        return NextResponse.json({ error: message }, { status: 500 });
    }
}
