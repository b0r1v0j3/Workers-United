import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import nodemailer from "nodemailer";
import { createAdminClient } from "@/lib/supabase/admin";

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
    n8n: ServiceCheck;
    timestamp: string;
}

function summarizeStatus(checks: HealthChecks): "healthy" | "degraded" {
    const states = [checks.supabase, checks.stripe, checks.smtp].map((c) => c.state);
    if (states.includes("down")) return "degraded";
    return "healthy";
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

export async function GET(request: NextRequest) {
    const detailedAuthHeader = request.headers.get("authorization");
    const canViewDetails = detailedAuthHeader === `Bearer ${process.env.CRON_SECRET}`;

    const checks: HealthChecks = {
        supabase: { state: "down", details: "Not checked yet" },
        vercel: { state: "ok", details: "Runtime active" },
        stripe: { state: "not_configured", details: "Missing STRIPE_SECRET_KEY" },
        smtp: { state: "not_configured", details: "Missing SMTP_USER/SMTP_PASS" },
        whatsapp: { state: "not_configured", details: "Missing WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID" },
        n8n: { state: "not_configured", details: "Missing N8N_WHATSAPP_WEBHOOK_URL" },
        timestamp: new Date().toISOString(),
    };

    // Supabase
    try {
        const adminClient = createAdminClient();
        const { error } = await adminClient.from("profiles").select("id").limit(1);
        checks.supabase = error
            ? { state: "down", details: error.message }
            : { state: "ok", details: "Database reachable" };
    } catch (err) {
        checks.supabase = {
            state: "down",
            details: err instanceof Error ? err.message : "Unknown error",
        };
    }

    // Stripe
    if (process.env.STRIPE_SECRET_KEY) {
        try {
            const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
                apiVersion: "2024-04-10",
            });
            await stripe.balance.retrieve();
            checks.stripe = { state: "ok", details: "API credentials valid" };
        } catch (err) {
            checks.stripe = {
                state: "down",
                details: err instanceof Error ? err.message : "Stripe check failed",
            };
        }
    }

    // SMTP
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
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
            checks.smtp = { state: "ok", details: "SMTP auth verified" };
        } catch (err) {
            checks.smtp = {
                state: "degraded",
                details: err instanceof Error ? err.message : "SMTP check failed",
            };
        }
    }

    // WhatsApp Cloud API
    if (process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
        try {
            const res = await fetch(
                `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}?fields=id`,
                {
                    headers: {
                        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
                    },
                    signal: AbortSignal.timeout(8000),
                }
            );

            if (res.ok) {
                checks.whatsapp = { state: "ok", details: "Cloud API reachable" };
            } else {
                checks.whatsapp = { state: "degraded", details: `HTTP ${res.status}` };
            }
        } catch (err) {
            checks.whatsapp = {
                state: "degraded",
                details: err instanceof Error ? err.message : "WhatsApp check failed",
            };
        }
    }

    // n8n reachability
    if (process.env.N8N_WHATSAPP_WEBHOOK_URL) {
        try {
            const res = await fetch(process.env.N8N_WHATSAPP_WEBHOOK_URL, {
                method: "HEAD",
                signal: AbortSignal.timeout(8000),
            });
            // 2xx/3xx/4xx means reachable. 5xx means remote issue.
            checks.n8n = res.status >= 500
                ? { state: "degraded", details: `HTTP ${res.status}` }
                : { state: "ok", details: `Reachable (${res.status})` };
        } catch (err) {
            checks.n8n = {
                state: "degraded",
                details: err instanceof Error ? err.message : "n8n check failed",
            };
        }
    }

    const status = summarizeStatus(checks);
    const code = status === "healthy" ? 200 : 503;

    if (!canViewDetails) {
        return NextResponse.json(publicPayload(status, checks), { status: code });
    }

    return NextResponse.json({ status, checks }, { status: code });
}
