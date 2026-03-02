import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ─── Platform Config Cache ──────────────────────────────────────────────────
// Reads business facts from `platform_config` table with 5-minute cache.
// Used by WhatsApp webhook, Brain Monitor, and admin UI.

export interface PlatformConfig {
    [key: string]: string;
}

let cachedConfig: PlatformConfig | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get all platform config values as a key-value map.
 * Caches for 5 minutes to avoid hitting DB on every WhatsApp message.
 * Uses admin client (no auth needed — config is public read).
 */
export async function getPlatformConfig(): Promise<PlatformConfig> {
    const now = Date.now();
    if (cachedConfig && (now - cacheTimestamp) < CACHE_TTL_MS) {
        return cachedConfig;
    }

    try {
        const supabase = createAdminClient();
        const { data, error } = await supabase
            .from("platform_config")
            .select("key, value");

        if (error || !data) {
            console.error("[PlatformConfig] DB error:", error?.message);
            return cachedConfig || getDefaults();
        }

        const config: PlatformConfig = {};
        for (const row of data) {
            config[row.key] = row.value;
        }

        cachedConfig = config;
        cacheTimestamp = now;
        return config;
    } catch (err) {
        console.error("[PlatformConfig] Failed to load:", err);
        return cachedConfig || getDefaults();
    }
}

/**
 * Force-refresh the cache (e.g., after admin update).
 */
export function invalidateConfigCache(): void {
    cachedConfig = null;
    cacheTimestamp = 0;
}

/**
 * Get a single config value by key.
 */
export async function getConfigValue(key: string, fallback?: string): Promise<string> {
    const config = await getPlatformConfig();
    return config[key] || fallback || "";
}

/**
 * Update a config value (admin only). Invalidates cache.
 */
export async function updateConfigValue(key: string, value: string, userId?: string): Promise<boolean> {
    try {
        const supabase = createAdminClient();
        const { error } = await supabase
            .from("platform_config")
            .upsert({
                key,
                value,
                updated_by: userId || null,
                updated_at: new Date().toISOString(),
            });

        if (error) {
            console.error("[PlatformConfig] Update error:", error.message);
            return false;
        }

        invalidateConfigCache();
        return true;
    } catch {
        return false;
    }
}

/**
 * Build a human-readable business facts block for AI system prompts.
 * Used by Brain Monitor and n8n AI agent.
 */
export async function getBusinessFactsForAI(): Promise<string> {
    const c = await getPlatformConfig();
    return [
        `Platform: ${c.platform_name || "Workers United"}`,
        `Website: ${c.website_url || "workersunited.eu"}`,
        `Entry fee: ${c.entry_fee || "$9"} (${c.entry_fee_currency || "USD"})`,
        `Refund policy: ${c.refund_policy_en || "90-day refund if no job offer"}`,
        `Placement fee (Serbia): ${c.placement_fee_serbia || "$190"}`,
        `Employer fee: ${c.employer_fee || "Free"}`,
        `Processing time: ${c.processing_time || "2-8 weeks"}`,
        `Required documents: ${c.supported_documents || "passport, diploma, biometric photo"}`,
        `Contact: ${c.contact_email || "contact@workersunited.eu"}`,
    ].join("\n");
}

// ─── Fallback defaults (used if DB is unreachable) ──────────────────────────

function getDefaults(): PlatformConfig {
    return {
        entry_fee: "$9",
        entry_fee_currency: "USD",
        refund_period_days: "90",
        refund_policy_en: "If you do not receive a job offer within 90 days, your fee is fully refunded.",
        refund_policy_sr: "Ukoliko ne dobijete ponudu za posao u roku od 90 dana, vaš novac će biti vraćen.",
        placement_fee_serbia: "$190",
        website_url: "workersunited.eu",
        contact_email: "contact@workersunited.eu",
        platform_name: "Workers United",
        supported_documents: "passport, diploma, biometric photo",
        processing_time: "2-8 weeks depending on country",
        bot_greeting_en: "Welcome to Workers United! 🌍 We help workers find jobs in Europe and handle all visa paperwork.",
        bot_greeting_sr: "Dobrodošli u Workers United! 🌍 Pomažemo radnicima da nađu posao u Evropi.",
        employer_fee: "Free — always",
    };
}
