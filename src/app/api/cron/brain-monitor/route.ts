import { NextResponse } from "next/server";
import type { AdminExceptionSnapshot } from "@/lib/admin-exceptions";
import { getCronAuthorizationHeader, hasValidCronBearerToken } from "@/lib/cron-auth";
import {
    buildOpsMonitorReport,
    getOpsMonitorEmailReasons,
} from "@/lib/ops-monitor";
import { normalizePlatformWebsiteUrl } from "@/lib/platform-contact";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const OPS_MONITOR_MODEL = "ops-first-monitor";
const OPS_MONITOR_EMAILS_ENABLED = false;
const CRITICAL_ROUTES = ["/login", "/signup", "/auth/callback", "/api/health"];

interface RouteHealthEntry {
    status: number | string;
    ok: boolean;
    latencyMs: number;
}

interface BrainCollectResponse {
    generatedAt?: string;
    documents?: {
        rejected?: number;
        pending?: number;
    };
    emails?: {
        recentFailedEmails?: Array<{
            email_type?: string | null;
            error_message?: string | null;
            created_at?: string | null;
        }>;
    };
    health?: {
        whatsappTemplateHealth?: {
            state?: string | null;
            details?: string | null;
            totalOutboundTemplates?: number | null;
            failedTemplates?: number | null;
            platformFailures?: number | null;
            recipientFailures?: number | null;
        } | null;
        recentFailedWhatsApp?: Array<{
            template_name?: string | null;
            error_message?: string | null;
            status?: string | null;
            date?: string | null;
        }>;
    };
    paymentTelemetry?: {
        failed?: number | null;
        abandoned?: number | null;
        pending?: number | null;
        successful?: number | null;
        totalAttempts?: number | null;
        recentAttempts?: Array<{
            action?: string | null;
            status?: string | null;
            created_at?: string | null;
            user_id?: string | null;
        }>;
    } | null;
    authHealth?: {
        status?: string | null;
        unconfirmedEmails?: { count?: number | null };
        workersWithoutWorkerOnboarding?: { count?: number | null };
        recentStuckSignups?: { count?: number | null };
    } | null;
    whatsappConversations?: {
        conversations?: Array<{
            phone?: string;
            messageCount?: number;
            messages?: Array<{
                role?: string;
                content?: string | null;
                time?: string | null;
            }>;
        }>;
    } | null;
    opsSnapshot?: AdminExceptionSnapshot;
}

async function getRouteHealth(baseUrl: string) {
    const routeHealth: Record<string, RouteHealthEntry> = {};

    for (const route of CRITICAL_ROUTES) {
        const startedAt = Date.now();

        try {
            const response = await fetch(`${baseUrl}${route}`, {
                method: "GET",
                redirect: "manual",
                signal: AbortSignal.timeout(10000),
            });

            routeHealth[route] = {
                status: response.status,
                ok: response.status < 500,
                latencyMs: Date.now() - startedAt,
            };
        } catch (error) {
            routeHealth[route] = {
                status: error instanceof Error ? error.message : "timeout",
                ok: false,
                latencyMs: Date.now() - startedAt,
            };
        }
    }

    return routeHealth;
}

export async function GET(request: Request) {
    const authHeader = request.headers.get("authorization");
    if (!hasValidCronBearerToken(authHeader)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startedAt = Date.now();
    const supabase = createAdminClient();
    const results = {
        dataCollected: false,
        opsReportBuilt: false,
        emailSent: false,
        emailSkipped: false,
        emailReason: null as string | null,
        emailError: null as string | null,
        reportSaved: false,
        signalCount: 0,
        criticalSignals: 0,
        highSignals: 0,
        error: null as string | null,
    };

    try {
        const baseUrl = normalizePlatformWebsiteUrl(process.env.NEXT_PUBLIC_BASE_URL);
        const cronAuthHeader = getCronAuthorizationHeader();

        if (!cronAuthHeader) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const collectResponse = await fetch(`${baseUrl}/api/brain/collect`, {
            headers: { Authorization: cronAuthHeader },
        });

        if (!collectResponse.ok) {
            throw new Error(`Data collection failed: ${collectResponse.status}`);
        }

        const platformData = await collectResponse.json() as BrainCollectResponse;
        results.dataCollected = true;

        const routeHealth = await getRouteHealth(baseUrl);
        const opsSnapshot = platformData.opsSnapshot;
        if (!opsSnapshot) {
            throw new Error("Brain collect did not return opsSnapshot");
        }

        const opsReport = buildOpsMonitorReport({
            generatedAt: platformData.generatedAt || new Date().toISOString(),
            opsSnapshot,
            routeHealth,
            whatsappTemplateHealth: platformData.health?.whatsappTemplateHealth || null,
            recentFailedWhatsApp: platformData.health?.recentFailedWhatsApp || [],
            recentFailedEmails: (platformData.emails?.recentFailedEmails || []).map((entry) => ({
                type: entry.email_type || null,
                error: entry.error_message || null,
                date: entry.created_at || null,
            })),
            whatsappConversations: platformData.whatsappConversations || null,
            paymentTelemetry: platformData.paymentTelemetry || null,
            authHealth: platformData.authHealth || null,
            documents: platformData.documents || null,
        });
        results.opsReportBuilt = true;
        results.signalCount = opsReport.metrics.totalSignals;
        results.criticalSignals = opsReport.metrics.criticalSignals;
        results.highSignals = opsReport.metrics.highSignals;

        const emailReasons = getOpsMonitorEmailReasons(opsReport);
        const emailSkipReason = emailReasons.length > 0
            ? "Ops monitor emails are disabled; exception snapshot saved to brain_reports only"
            : "No critical or high-priority ops signals — saved to brain_reports only";

        const reportPayload = {
            report_type: emailReasons.length > 0 ? "ops_daily_exception" : "ops_daily_snapshot",
            monitor_mode: "ops_first",
            email_summary: opsReport.summary,
            email_reasons: emailReasons,
            delivery_mode: "db_only",
            email_delivery: emailReasons.length > 0 ? "suppressed" : "skipped",
            email_error: results.emailError,
            structured_report: {
                ...opsReport,
                routeHealth,
                whatsappTemplateHealth: platformData.health?.whatsappTemplateHealth || null,
            },
        };

        const { error: saveReportError } = await supabase.from("brain_reports").insert({
            report: reportPayload,
            model: OPS_MONITOR_MODEL,
            findings_count: opsReport.signals.length,
        });

        if (saveReportError) {
            throw new Error(`Failed to save ops report: ${saveReportError.message}`);
        }

        results.reportSaved = true;
        results.emailSkipped = true;
        results.emailReason = emailSkipReason;

        const duration = ((Date.now() - startedAt) / 1000).toFixed(1);
        return NextResponse.json({
            success: true,
            duration: `${duration}s`,
            ...results,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("[Ops Monitor] Error:", message);
        results.error = message;

        try {
            const { error: saveFailureError } = await supabase.from("brain_reports").insert({
                report: {
                    report_type: "ops_daily_failure",
                    monitor_mode: "ops_first",
                    delivery_mode: "db_only",
                    email_delivery: "suppressed",
                    email_error: null,
                    failure_message: message,
                    failure_context: results,
                    failed_at: new Date().toISOString(),
                },
                model: OPS_MONITOR_MODEL,
                findings_count: 0,
            });

            if (!saveFailureError) {
                results.reportSaved = true;
                results.emailSkipped = true;
                results.emailReason = "Failure snapshot saved to brain_reports; failure email suppressed";
            } else {
                console.error("[Ops Monitor] Failed to save failure snapshot:", saveFailureError.message);
            }
        } catch (saveFailure) {
            console.error("[Ops Monitor] Unexpected failure while saving crash snapshot:", saveFailure);
        }

        return NextResponse.json({ errorMessage: message, ...results }, { status: 500 });
    }
}
