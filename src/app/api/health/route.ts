import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import nodemailer from "nodemailer";
import { createAdminClient } from "@/lib/supabase/admin";
import { summarizeWhatsAppTemplateHealth } from "@/lib/whatsapp-health";

type ServiceState = "ok" | "degraded" | "down" | "not_configured";

interface ServiceCheck {
    state: ServiceState;
    details: string;
}

interface HealthChecks {
    supabase: ServiceCheck;
    vercel: ServiceCheck;
    stripe: ServiceCheck;
    smtp: ServiceCheck;
    whatsapp: ServiceCheck;
    timestamp: string;
}

function summarizeStatus(checks: HealthChecks): "healthy" | "degraded" {
    const states = [checks.supabase, checks.stripe, checks.smtp].map((c) => c.state);
    return states.every((state) => state === "ok") ? "healthy" : "degraded";
}

function publicPayload(status: "healthy" | "degraded", checks: HealthChecks) {
    return {
        status,
        checks: {
            supabase: checks.supabase.state,
            vercel: checks.vercel.state,
            timestamp: checks.timestamp,
        },
    };
}

async function checkSupabase(adminClient: ReturnType<typeof createAdminClient>): Promise<ServiceCheck> {
    try {
        const { error } = await adminClient.from("profiles").select("id").limit(1);
        return error
            ? { state: "down", details: error.message }
            : { state: "ok", details: "Database reachable" };
    } catch (err) {
        return {
            state: "down",
            details: err instanceof Error ? err.message : "Unknown error",
        };
    }
}

async function checkStripe(): Promise<ServiceCheck> {
    if (!process.env.STRIPE_SECRET_KEY) {
        return { state: "not_configured", details: "Missing STRIPE_SECRET_KEY" };
    }

    try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
            apiVersion: "2024-04-10",
        });
        await stripe.balance.retrieve();
        return { state: "ok", details: "API credentials valid" };
    } catch (err) {
        return {
            state: "down",
            details: err instanceof Error ? err.message : "Stripe check failed",
        };
    }
}

async function checkSmtp(): Promise<ServiceCheck> {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        return { state: "not_configured", details: "Missing SMTP_USER/SMTP_PASS" };
    }

    try {
        const transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 587,
            secure: false,
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
            connectionTimeout: 8000,
            greetingTimeout: 8000,
            socketTimeout: 8000,
        });
        await transporter.verify();
        return { state: "ok", details: "SMTP auth verified" };
    } catch (err) {
        return {
            state: "degraded",
            details: err instanceof Error ? err.message : "SMTP check failed",
        };
    }
}

async function checkWhatsApp(adminClient: ReturnType<typeof createAdminClient>): Promise<ServiceCheck> {
    if (!process.env.WHATSAPP_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
        return { state: "not_configured", details: "Missing WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID" };
    }

    try {
        const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const [graphRes, outboundAudit, failedAudit] = await Promise.all([
            fetch(
                `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}?fields=id`,
                {
                    headers: {
                        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
                    },
                    signal: AbortSignal.timeout(8000),
                }
            ),
            adminClient
                .from("whatsapp_messages")
                .select("id", { count: "exact", head: true })
                .eq("direction", "outbound")
                .eq("message_type", "template")
                .gte("created_at", sinceIso),
            adminClient
                .from("whatsapp_messages")
                .select("template_name,error_message")
                .eq("direction", "outbound")
                .eq("message_type", "template")
                .eq("status", "failed")
                .gte("created_at", sinceIso)
                .order("created_at", { ascending: false })
                .limit(100),
        ]);

        if (!graphRes.ok) {
            return { state: "degraded", details: `HTTP ${graphRes.status}` };
        }

        if (outboundAudit.error || failedAudit.error) {
            return {
                state: "degraded",
                details: "Cloud API reachable, but recent template delivery audit failed",
            };
        }

        const summary = summarizeWhatsAppTemplateHealth({
            totalOutboundTemplates: outboundAudit.count || 0,
            failedMessages: (failedAudit.data || []).map((message) => ({
                templateName: message.template_name,
                errorMessage: message.error_message,
            })),
        });

        return { state: summary.state, details: summary.details };
    } catch (err) {
        return {
            state: "degraded",
            details: err instanceof Error ? err.message : "WhatsApp check failed",
        };
    }
}

export async function GET(request: NextRequest) {
    const detailedAuthHeader = request.headers.get("authorization");
    const canViewDetails = detailedAuthHeader === `Bearer ${process.env.CRON_SECRET}`;
    const adminClient = createAdminClient();

    const checks: HealthChecks = {
        supabase: { state: "down", details: "Not checked yet" },
        vercel: { state: "ok", details: "Runtime active" },
        stripe: { state: "not_configured", details: "Missing STRIPE_SECRET_KEY" },
        smtp: { state: "not_configured", details: "Missing SMTP_USER/SMTP_PASS" },
        whatsapp: { state: "not_configured", details: "Missing WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID" },
        timestamp: new Date().toISOString(),
    };

    const [supabase, stripe, smtp, whatsapp] = await Promise.all([
        checkSupabase(adminClient),
        checkStripe(),
        checkSmtp(),
        checkWhatsApp(adminClient),
    ]);

    checks.supabase = supabase;
    checks.stripe = stripe;
    checks.smtp = smtp;
    checks.whatsapp = whatsapp;

    const status = summarizeStatus(checks);
    const code = status === "healthy" ? 200 : 503;

    if (!canViewDetails) {
        return NextResponse.json(publicPayload(status, checks), { status: code });
    }

    return NextResponse.json({ status, checks }, { status: code });
}
