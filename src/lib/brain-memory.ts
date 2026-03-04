import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type AdminClient = SupabaseClient<Database>;

const DEFAULT_CONFIDENCE = 0.8;
const CONFIDENCE_EPSILON = 0.05;
const MAX_FACTS_PER_CATEGORY_LOOKUP = 1000;

const ALLOWED_CATEGORIES = new Set([
    "pricing",
    "process",
    "documents",
    "eligibility",
    "faq",
    "company_info",
    "legal",
    "error_fix",
    "common_question",
    "system_stats",
    "stats",
]);

export interface BrainFactInput {
    category: string;
    content: string;
    confidence?: number | null;
}

export interface BrainFactSaveStats {
    inserted: number;
    updated: number;
    skipped: number;
}

interface ExistingFact {
    id: string;
    category: string;
    content: string;
    confidence: number | null;
}

export function normalizeBrainCategory(category: string): string {
    const normalized = category.trim().toLowerCase().replace(/\s+/g, "_");
    return ALLOWED_CATEGORIES.has(normalized) ? normalized : "faq";
}

export function normalizeBrainContent(content: string): string {
    return content.replace(/\s+/g, " ").trim();
}

function normalizeConfidence(confidence: number | null | undefined): number {
    if (typeof confidence !== "number" || Number.isNaN(confidence)) {
        return DEFAULT_CONFIDENCE;
    }
    return Math.max(0, Math.min(1, confidence));
}

function toFactKey(category: string, content: string): string {
    return `${category}::${content.toLowerCase()}`;
}

export function dedupeBrainFacts(facts: BrainFactInput[]): BrainFactInput[] {
    const map = new Map<string, BrainFactInput>();

    for (const fact of facts) {
        const category = normalizeBrainCategory(fact.category);
        const content = normalizeBrainContent(fact.content);

        if (!content) continue;

        const confidence = normalizeConfidence(fact.confidence);
        const key = toFactKey(category, content);
        const existing = map.get(key);

        if (!existing || confidence > normalizeConfidence(existing.confidence)) {
            map.set(key, { category, content, confidence });
        }
    }

    return [...map.values()];
}

export async function saveBrainFactsDedup(
    supabase: AdminClient,
    facts: BrainFactInput[]
): Promise<BrainFactSaveStats> {
    const preparedFacts = dedupeBrainFacts(facts);
    const stats: BrainFactSaveStats = { inserted: 0, updated: 0, skipped: 0 };

    if (preparedFacts.length === 0) {
        return stats;
    }

    const categories = [...new Set(preparedFacts.map((f) => f.category))];
    const existingByKey = new Map<string, ExistingFact>();

    for (const category of categories) {
        const { data } = await supabase
            .from("brain_memory")
            .select("id, category, content, confidence")
            .eq("category", category)
            .order("created_at", { ascending: false })
            .limit(MAX_FACTS_PER_CATEGORY_LOOKUP);

        for (const fact of data || []) {
            const normalizedContent = normalizeBrainContent(fact.content);
            if (!normalizedContent) continue;

            const key = toFactKey(category, normalizedContent);
            if (!existingByKey.has(key)) {
                existingByKey.set(key, {
                    id: fact.id,
                    category,
                    content: normalizedContent,
                    confidence: fact.confidence,
                });
            }
        }
    }

    for (const fact of preparedFacts) {
        const key = toFactKey(fact.category, fact.content);
        const current = existingByKey.get(key);

        if (!current) {
            const { error } = await supabase.from("brain_memory").insert({
                category: fact.category,
                content: fact.content,
                confidence: normalizeConfidence(fact.confidence),
            });

            if (error) {
                stats.skipped++;
                continue;
            }

            stats.inserted++;
            continue;
        }

        const incomingConfidence = normalizeConfidence(fact.confidence);
        const existingConfidence = normalizeConfidence(current.confidence);
        const shouldUpgradeConfidence = incomingConfidence - existingConfidence >= CONFIDENCE_EPSILON;

        if (!shouldUpgradeConfidence) {
            stats.skipped++;
            continue;
        }

        const { error } = await supabase
            .from("brain_memory")
            .update({ confidence: incomingConfidence })
            .eq("id", current.id);

        if (error) {
            stats.skipped++;
            continue;
        }

        stats.updated++;
    }

    return stats;
}
