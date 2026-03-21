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

const BLOCKED_BRAIN_FACT_CATEGORIES = new Set([
    "system_stats",
    "stats",
]);

const CANONICAL_PRICING_FACT: BrainFactInput = {
    category: "pricing",
    content: "Workers pay the $9 Job Finder service charge only after their profile, required documents, and admin approval unlock checkout; any placement fee is paid only after a job is found. Employers never pay platform fees.",
    confidence: 1,
};

const INVALID_PRICING_PATTERNS = [
    /placement fee[\s\S]{0,120}pay(?:s|able|ing|ment)?[\s\S]{0,40}employer/i,
    /employer[\s\S]{0,120}pay(?:s|able|ing|ment)?[\s\S]{0,40}placement fee/i,
    /charged[\s\S]{0,40}to the employer[\s\S]{0,80}placement fee/i,
    /placement fee[\s\S]{0,80}for the employer/i,
];

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

export function isInvalidPricingBrainFact(content: string): boolean {
    const normalized = normalizeBrainContent(content).toLowerCase();
    if (!normalized || !normalized.includes("placement fee")) {
        return false;
    }

    return INVALID_PRICING_PATTERNS.some((pattern) => pattern.test(normalized))
        || (
            normalized.includes("placement fee")
            && normalized.includes("employer fee")
            && !normalized.includes("worker pays")
            && !normalized.includes("workers pay")
            && !normalized.includes("paid by the worker")
            && !normalized.includes("paid by workers")
        );
}

export function prepareBrainFactsForStorage(facts: BrainFactInput[]): BrainFactInput[] {
    const filtered = facts.filter((fact) => {
        const category = normalizeBrainCategory(fact.category);
        const content = normalizeBrainContent(fact.content);

        if (!content) {
            return false;
        }

        if (BLOCKED_BRAIN_FACT_CATEGORIES.has(category)) {
            return false;
        }

        if (isInvalidPricingBrainFact(content)) {
            return false;
        }

        return true;
    });

    return dedupeBrainFacts([
        ...filtered,
        CANONICAL_PRICING_FACT,
    ]);
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
    const preparedFacts = prepareBrainFactsForStorage(facts);
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

export async function pruneInvalidBrainFacts(supabase: AdminClient): Promise<number> {
    const candidateCategories = ["pricing", "eligibility", "faq", "common_question"];
    const idsToDelete = new Set<string>();

    for (const category of candidateCategories) {
        const { data } = await supabase
            .from("brain_memory")
            .select("id, content")
            .eq("category", category)
            .order("created_at", { ascending: false })
            .limit(MAX_FACTS_PER_CATEGORY_LOOKUP);

        for (const fact of data || []) {
            if (isInvalidPricingBrainFact(fact.content)) {
                idsToDelete.add(fact.id);
            }
        }
    }

    if (idsToDelete.size === 0) {
        return 0;
    }

    const { error } = await supabase
        .from("brain_memory")
        .delete()
        .in("id", [...idsToDelete]);

    if (error) {
        return 0;
    }

    return idsToDelete.size;
}
