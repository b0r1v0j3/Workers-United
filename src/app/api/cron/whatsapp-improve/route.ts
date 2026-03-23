import { NextResponse } from "next/server";
import { hasValidCronBearerToken } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveBrainFactsDedup } from "@/lib/brain-memory";
import {
    loadRecentConversations,
    analyzeConversations,
    type SelfImprovementReport,
} from "@/lib/whatsapp-self-improve";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const REPORT_MODEL = "whatsapp-self-improve";

export async function GET(request: Request) {
    if (!hasValidCronBearerToken(request)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = (process.env.ANTHROPIC_API_KEY || "").trim();
    if (!apiKey) {
        return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    }

    const supabase = createAdminClient();
    let report: SelfImprovementReport;

    try {
        // Load recent conversations
        const threads = await loadRecentConversations(supabase, 48);

        if (threads.length === 0) {
            const emptyReport: SelfImprovementReport = {
                analyzed_threads: 0,
                analyzed_messages: 0,
                insights: [],
                summary: "No conversations in the last 48 hours.",
            };

            await saveSelfImprovementReport(supabase, emptyReport);
            return NextResponse.json({ status: "ok", ...emptyReport });
        }

        // Load existing brain facts to avoid duplicates
        const { data: existingFacts } = await supabase
            .from("brain_memory")
            .select("content")
            .order("confidence", { ascending: false })
            .limit(50);

        const existingFactsList = Array.isArray(existingFacts)
            ? existingFacts.map((f: { content: string }) => f.content)
            : [];

        // Analyze with Claude
        report = await analyzeConversations(apiKey, threads, existingFactsList);

        // Save useful insights to brain_memory
        if (report.insights.length > 0) {
            const factsToSave = report.insights.map((insight) => ({
                category: insight.category,
                content: insight.content,
                confidence: insight.confidence,
            }));

            const saveStats = await saveBrainFactsDedup(supabase, factsToSave);
            console.log(
                `[WhatsApp Self-Improve] Saved ${saveStats.inserted} new, updated ${saveStats.updated}, skipped ${saveStats.skipped}`
            );
        }

        // Save report to brain_reports
        await saveSelfImprovementReport(supabase, report);

        console.log(
            `[WhatsApp Self-Improve] Analyzed ${report.analyzed_threads} threads, found ${report.insights.length} insights`
        );

        return NextResponse.json({ status: "ok", ...report });
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error("[WhatsApp Self-Improve] Error:", errMsg);

        // Save failure report
        try {
            await supabase.from("brain_reports").insert({
                model: REPORT_MODEL,
                report: {
                    report_type: "self_improve_failure",
                    error: errMsg,
                },
                findings_count: 0,
            });
        } catch {
            // ignore save error
        }

        return NextResponse.json({ status: "error", error: errMsg }, { status: 500 });
    }
}

async function saveSelfImprovementReport(
    supabase: ReturnType<typeof createAdminClient>,
    report: SelfImprovementReport
) {
    await supabase.from("brain_reports").insert({
        model: REPORT_MODEL,
        report: {
            report_type: "self_improve_daily",
            analyzed_threads: report.analyzed_threads,
            analyzed_messages: report.analyzed_messages,
            insights: report.insights,
            summary: report.summary,
        },
        findings_count: report.insights.length,
    });
}
