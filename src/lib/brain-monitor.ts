const KNOWN_OPERATION_STATUSES = new Set(["OK", "WARNING", "CRITICAL", "SUGGESTIONS"]);

export interface BrainIssue {
    title: string;
    body: string;
    priority: "P0" | "P1" | "P2";
    labels: string[];
    operation?: string;
}

export interface BrainAction {
    type: string;
    description: string;
    params?: Record<string, unknown>;
}

export interface BrainOperation {
    name: string;
    emoji: string;
    status: string;
    findings: string[];
    score: number;
}

export interface BrainImprovement {
    title: string;
    description: string;
    impact: string;
    effort: string;
}

export interface BrainFact {
    category: string;
    content: string;
}

export interface BrainAnalysis {
    summary: string;
    healthScore: number;
    operations: BrainOperation[];
    issues: BrainIssue[];
    improvements: BrainImprovement[];
    actions: BrainAction[];
    brainFacts: BrainFact[];
    selfImprovements: string[];
    metrics: {
        totalWorkers: number;
        totalEmployers: number;
        documentsVerified: number;
        emailDeliveryRate: string;
        funnelProgression: string;
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
    if (typeof value === "string") {
        return value.trim();
    }

    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }

    return "";
}

function asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map((entry) => asString(entry))
        .filter((entry) => entry.length > 0);
}

function asNumber(value: unknown, fallback: number): number {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === "string") {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }

    return fallback;
}

function clampScore(value: unknown, fallback: number): number {
    const numeric = Math.round(asNumber(value, fallback));
    return Math.min(100, Math.max(0, numeric));
}

function nonNegativeInteger(value: unknown, fallback = 0): number {
    return Math.max(0, Math.round(asNumber(value, fallback)));
}

function normalizeOperationStatus(value: unknown, score: number): string {
    const normalized = asString(value).toUpperCase();
    if (KNOWN_OPERATION_STATUSES.has(normalized)) {
        return normalized;
    }

    if (score >= 80) return "OK";
    if (score >= 50) return "WARNING";
    return "CRITICAL";
}

function normalizePriority(value: unknown): "P0" | "P1" | "P2" {
    const normalized = asString(value).toUpperCase();
    if (normalized === "P0" || normalized === "P1") {
        return normalized;
    }
    return "P2";
}

function normalizeOperation(raw: unknown, index: number): BrainOperation {
    const record = isRecord(raw) ? raw : {};
    const score = clampScore(record.score, 70);
    const name = asString(record.name) || `Operation ${index + 1}`;

    return {
        name,
        emoji: asString(record.emoji) || "•",
        status: normalizeOperationStatus(record.status, score),
        findings: asStringArray(record.findings),
        score,
    };
}

function normalizeIssue(raw: unknown, index: number): BrainIssue {
    const record = isRecord(raw) ? raw : {};

    return {
        title: asString(record.title) || `Brain issue ${index + 1}`,
        body: asString(record.body) || "No issue body provided.",
        priority: normalizePriority(record.priority),
        labels: asStringArray(record.labels),
        operation: asString(record.operation) || undefined,
    };
}

function normalizeImprovement(raw: unknown, index: number): BrainImprovement {
    const record = isRecord(raw) ? raw : {};

    return {
        title: asString(record.title) || `Improvement ${index + 1}`,
        description: asString(record.description) || "No description provided.",
        impact: asString(record.impact) || "medium",
        effort: asString(record.effort) || "medium",
    };
}

function normalizeAction(raw: unknown): BrainAction {
    const record = isRecord(raw) ? raw : {};
    const params = isRecord(record.params) ? record.params : {};

    return {
        type: asString(record.type) || "log_observation",
        description: asString(record.description) || "No description provided.",
        params,
    };
}

function normalizeBrainFact(raw: unknown): BrainFact | null {
    const record = isRecord(raw) ? raw : {};
    const category = asString(record.category);
    const content = asString(record.content);

    if (!category || !content) {
        return null;
    }

    return { category, content };
}

export function normalizeBrainAnalysis(raw: unknown): BrainAnalysis {
    if (!isRecord(raw)) {
        throw new Error("AI response did not contain the expected JSON object");
    }

    const metricsRecord = isRecord(raw.metrics) ? raw.metrics : {};
    const operations = Array.isArray(raw.operations)
        ? raw.operations.map((operation, index) => normalizeOperation(operation, index))
        : [];
    const issues = Array.isArray(raw.issues)
        ? raw.issues.map((issue, index) => normalizeIssue(issue, index))
        : [];
    const improvements = Array.isArray(raw.improvements)
        ? raw.improvements.map((improvement, index) => normalizeImprovement(improvement, index))
        : [];
    const actions = Array.isArray(raw.actions)
        ? raw.actions.map((action) => normalizeAction(action))
        : [];
    const brainFacts = Array.isArray(raw.brainFacts)
        ? raw.brainFacts
            .map((fact) => normalizeBrainFact(fact))
            .filter((fact): fact is BrainFact => Boolean(fact))
        : [];

    return {
        summary: asString(raw.summary) || "Automated brain snapshot saved without a narrative summary.",
        healthScore: clampScore(raw.healthScore, 0),
        operations,
        issues,
        improvements,
        actions,
        brainFacts,
        selfImprovements: asStringArray(raw.selfImprovements),
        metrics: {
            totalWorkers: nonNegativeInteger(metricsRecord.totalWorkers, 0),
            totalEmployers: nonNegativeInteger(metricsRecord.totalEmployers, 0),
            documentsVerified: nonNegativeInteger(metricsRecord.documentsVerified, 0),
            emailDeliveryRate: asString(metricsRecord.emailDeliveryRate) || "N/A",
            funnelProgression: asString(metricsRecord.funnelProgression) || "No funnel summary provided.",
        },
    };
}

export function unwrapResponseJsonText(text: string): string {
    const trimmed = text.trim();
    const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    return fencedMatch ? fencedMatch[1].trim() : trimmed;
}

export function extractResponsesJsonText(aiData: unknown): string | null {
    if (isRecord(aiData) && typeof aiData.output_text === "string" && aiData.output_text.trim()) {
        return unwrapResponseJsonText(aiData.output_text);
    }

    if (!isRecord(aiData) || !Array.isArray(aiData.output)) {
        return null;
    }

    const contentTexts = aiData.output
        .flatMap((item) => (isRecord(item) && Array.isArray(item.content) ? item.content : []))
        .map((part) => (isRecord(part) && typeof part.text === "string" ? unwrapResponseJsonText(part.text) : null))
        .filter((text): text is string => Boolean(text && text.trim().length > 0));

    const jsonText = contentTexts.find((text) => text.startsWith("{") && text.endsWith("}"));
    return jsonText || contentTexts[0] || null;
}

export function parseBrainAnalysis(aiData: unknown): BrainAnalysis {
    const aiContent = extractResponsesJsonText(aiData);

    if (!aiContent) {
        throw new Error("Empty AI response");
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(aiContent);
    } catch {
        throw new Error(`Failed to parse AI response: ${aiContent.substring(0, 300)}`);
    }

    return normalizeBrainAnalysis(parsed);
}

export function getRetryEmailIds(params: Record<string, unknown> | undefined): string[] {
    if (!params) return [];

    const ids = new Set<string>();

    if (typeof params.email_id === "string" && params.email_id.trim()) {
        ids.add(params.email_id);
    }

    if (Array.isArray(params.email_ids)) {
        for (const rawId of params.email_ids) {
            if (typeof rawId === "string" && rawId.trim()) {
                ids.add(rawId);
            }
        }
    }

    return Array.from(ids);
}

export function getDailyExceptionReasons(
    analysis: BrainAnalysis,
    dailyExceptionHealthThreshold: number
): string[] {
    const reasons: string[] = [];

    if (analysis.issues.length > 0) {
        reasons.push(`${analysis.issues.length} issue(s) detected`);
    }

    if (analysis.actions.some((action) => action.type === "retry_email")) {
        reasons.push("auto-retry email action suggested");
    }

    if (analysis.operations.some((operation) => operation.status === "CRITICAL")) {
        reasons.push("at least one operation is CRITICAL");
    }

    if (analysis.healthScore < dailyExceptionHealthThreshold) {
        reasons.push(`health score below ${dailyExceptionHealthThreshold}`);
    }

    return reasons;
}
