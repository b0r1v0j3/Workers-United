import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import AppShell from "@/components/AppShell";
import { isGodModeUser } from "@/lib/godmode";

type ServiceCheck = {
    name: string;
    description: string;
    status: "operational" | "degraded" | "down" | "not_configured";
    responseTime?: number;
    details?: string;
};

async function checkSupabase(): Promise<ServiceCheck> {
    const start = Date.now();
    try {
        const adminClient = createAdminClient();
        const { error } = await adminClient.from("profiles").select("id").limit(1);
        const responseTime = Date.now() - start;
        if (error) {
            return { name: "Supabase", description: "Database & Authentication", status: "degraded", responseTime, details: error.message };
        }
        return { name: "Supabase", description: "Database & Authentication", status: "operational", responseTime, details: `Query OK (${responseTime}ms)` };
    } catch (err) {
        return { name: "Supabase", description: "Database & Authentication", status: "down", responseTime: Date.now() - start, details: "Connection failed" };
    }
}

async function checkVercel(): Promise<ServiceCheck> {
    // Build the health check URL from available env vars
    let baseUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!baseUrl) {
        const vercelUrl = process.env.VERCEL_URL;
        if (vercelUrl) {
            baseUrl = `https://${vercelUrl}`;
        } else {
            return { name: "Vercel", description: "Hosting & Deployment", status: "degraded", details: "NEXT_PUBLIC_SITE_URL not set — add it in Vercel env vars" };
        }
    }
    const healthUrl = `${baseUrl}/api/health`;
    const start = Date.now();
    try {
        const res = await fetch(healthUrl, { signal: AbortSignal.timeout(5000) });
        const responseTime = Date.now() - start;
        if (res.ok) {
            return { name: "Vercel", description: "Hosting & Deployment", status: "operational", responseTime, details: `Health check OK (${responseTime}ms)` };
        }
        return { name: "Vercel", description: "Hosting & Deployment", status: "degraded", responseTime, details: `Health check returned HTTP ${res.status} (${responseTime}ms)` };
    } catch {
        return { name: "Vercel", description: "Hosting & Deployment", status: "down", responseTime: Date.now() - start, details: "Health check unreachable" };
    }
}

function checkGemini(): ServiceCheck {
    const hasKey = !!process.env.GEMINI_API_KEY || !!process.env.GOOGLE_AI_API_KEY;
    return {
        name: "Google Gemini",
        description: "AI Processing & Matching",
        status: hasKey ? "operational" : "not_configured",
        details: hasKey ? "API key configured" : "GEMINI_API_KEY not set",
    };
}

function checkStripe(): ServiceCheck {
    const hasSecret = !!process.env.STRIPE_SECRET_KEY;
    const hasPublic = !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (hasSecret && hasPublic) {
        return { name: "Stripe", description: "Payment Processing", status: "operational", details: "Keys configured" };
    }
    if (hasSecret || hasPublic) {
        return { name: "Stripe", description: "Payment Processing", status: "degraded", details: "Partial config — missing key" };
    }
    return { name: "Stripe", description: "Payment Processing", status: "not_configured", details: "No API keys set" };
}

function checkWhatsApp(): ServiceCheck {
    const hasToken = !!process.env.WHATSAPP_TOKEN;
    return {
        name: "WhatsApp",
        description: "Messaging & Notifications",
        status: hasToken ? "operational" : "not_configured",
        details: hasToken ? "Token configured" : "WHATSAPP_TOKEN not set",
    };
}

export default async function AdminSettingsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const isOwner = isGodModeUser(user.email);

    // Run all health checks in parallel
    const [supabaseCheck, vercelCheck] = await Promise.all([
        checkSupabase(),
        checkVercel(),
    ]);
    const geminiCheck = checkGemini();
    const stripeCheck = checkStripe();
    const whatsappCheck = checkWhatsApp();

    const services: ServiceCheck[] = [supabaseCheck, vercelCheck, geminiCheck, stripeCheck, whatsappCheck];

    const operationalCount = services.filter(s => s.status === "operational").length;
    const totalCount = services.length;
    const allGood = services.every(s => s.status === "operational" || s.status === "not_configured");

    return (
        <AppShell user={user} variant="admin">
            <div className="space-y-6">
                {/* Header */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h1 className="text-2xl font-bold text-slate-900">Settings & Services</h1>
                    <p className="text-slate-500">Platform configuration and live service status.</p>
                </div>

                {/* Overall Status Banner */}
                <div className={`rounded-xl border p-5 flex items-center gap-4 ${allGood
                    ? "bg-gradient-to-r from-emerald-50 to-green-50 border-green-200"
                    : "bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200"
                    }`}>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${allGood ? "bg-green-100" : "bg-amber-100"
                        }`}>
                        {allGood ? "✅" : "⚠️"}
                    </div>
                    <div>
                        <h2 className={`font-bold text-lg ${allGood ? "text-green-800" : "text-amber-800"}`}>
                            {allGood ? "All Systems Operational" : "Some Services Need Attention"}
                        </h2>
                        <p className={`text-sm ${allGood ? "text-green-600" : "text-amber-600"}`}>
                            {operationalCount} of {totalCount} services active
                        </p>
                    </div>
                </div>

                {/* Services Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {services.map(service => (
                        <ServiceCard key={service.name} service={service} />
                    ))}
                </div>

                {/* Platform Info */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h2 className="text-lg font-bold text-slate-900 mb-4">Platform Info</h2>
                    <div className="space-y-3">
                        <InfoRow label="Logged in as" value={user.email || "Unknown"} />
                        <InfoRow label="God Mode" value={isOwner ? "✅ Active" : "❌ Inactive"} />
                        <InfoRow label="Environment" value={process.env.NODE_ENV || "production"} />
                        <InfoRow label="Site URL" value={process.env.NEXT_PUBLIC_SITE_URL || "Not set"} />
                    </div>
                </div>

                {/* Pricing */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h2 className="text-lg font-bold text-slate-900 mb-4">Pricing Configuration</h2>
                    <div className="space-y-3">
                        <InfoRow label="Entry Fee" value="$9 (universal)" />
                        <InfoRow label="Placement Fee (Serbia)" value="$190" />
                        <InfoRow label="Refund Policy" value="90 days, auto-flagged" />
                        <InfoRow label="Employer Cost" value="FREE (always)" />
                    </div>
                </div>
            </div>
        </AppShell>
    );
}

function ServiceCard({ service }: { service: ServiceCheck }) {
    const statusConfig = {
        operational: {
            bg: "bg-green-50 border-green-200",
            badge: "bg-green-100 text-green-700 border-green-300",
            dot: "bg-green-500",
            label: "OPERATIONAL",
            icon: "🟢",
        },
        degraded: {
            bg: "bg-amber-50 border-amber-200",
            badge: "bg-amber-100 text-amber-700 border-amber-300",
            dot: "bg-amber-500",
            label: "DEGRADED",
            icon: "🟡",
        },
        down: {
            bg: "bg-red-50 border-red-200",
            badge: "bg-red-100 text-red-700 border-red-300",
            dot: "bg-red-500",
            label: "DOWN",
            icon: "🔴",
        },
        not_configured: {
            bg: "bg-slate-50 border-slate-200",
            badge: "bg-slate-100 text-slate-600 border-slate-300",
            dot: "bg-slate-400",
            label: "NOT CONFIGURED",
            icon: "⚪",
        },
    };

    const config = statusConfig[service.status];

    return (
        <div className={`rounded-xl border p-5 ${config.bg} transition-all hover:shadow-sm`}>
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                    <span className="text-lg">{config.icon}</span>
                    <h3 className="font-bold text-slate-900">{service.name}</h3>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${config.badge}`}>
                    {config.label}
                </span>
            </div>
            <p className="text-sm text-slate-500 mb-2">{service.description}</p>
            {service.details && (
                <p className="text-xs text-slate-400 font-mono">{service.details}</p>
            )}
            {service.responseTime !== undefined && (
                <div className="mt-2 flex items-center gap-1">
                    <span className="text-xs text-slate-400">⚡</span>
                    <span className="text-xs text-slate-500 font-medium">{service.responseTime}ms</span>
                </div>
            )}
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
            <span className="text-sm text-slate-500 font-medium">{label}</span>
            <span className="text-sm text-slate-900 font-semibold">{value}</span>
        </div>
    );
}
