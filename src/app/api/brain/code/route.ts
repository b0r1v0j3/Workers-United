import { NextRequest, NextResponse } from "next/server";

// ─── Brain Code Reader ──────────────────────────────────────────────────────
// Reads source code files from GitHub for AI brain analysis
// Uses GitHub API to fetch all TypeScript/TSX files from the repo
//
// Auth: Requires CRON_SECRET bearer token

const GITHUB_REPO = "b0r1v0j3/Workers-United";
const GITHUB_BRANCH = "main";

// Key files and directories to analyze (ordered by importance)
const KEY_PATHS = [
    // ─── Schema & Types (CRITICAL for column validation) ───
    "src/lib/database.types.ts",

    // ─── Middleware (auth + CSRF) ───
    "src/middleware.ts",

    // ─── Critical API routes ───
    "src/app/api/stripe/webhook/route.ts",
    "src/app/api/stripe/create-checkout/route.ts",
    "src/app/api/whatsapp/webhook/route.ts",
    "src/app/api/account/delete/route.ts",
    "src/app/api/account/export/route.ts",
    "src/app/api/verify-document/route.ts",
    "src/app/api/documents/verify/route.ts",
    "src/app/api/documents/verify-passport/route.ts",
    "src/app/api/send-email/route.ts",
    "src/app/api/profile/route.ts",
    "src/app/api/offers/route.ts",
    "src/app/api/signatures/route.ts",
    "src/app/api/notifications/route.ts",
    "src/app/api/email-queue/route.ts",
    "src/app/api/health/route.ts",
    "src/app/api/godmode/route.ts",
    "src/app/api/queue-user-email/route.ts",

    // ─── Admin API routes ───
    "src/app/api/admin/delete-user/route.ts",
    "src/app/api/admin/edit-data/route.ts",
    "src/app/api/admin/manual-match/route.ts",
    "src/app/api/admin/re-verify/route.ts",
    "src/app/api/admin/employer-status/route.ts",
    "src/app/api/admin/document-status/route.ts",
    "src/app/api/admin/email-preview/route.ts",
    "src/app/api/admin/funnel-metrics/route.ts",
    "src/app/api/admin/search/route.ts",

    // ─── Contract / Document generation ───
    "src/app/api/contracts/prepare/route.ts",
    "src/app/api/contracts/generate/route.ts",
    "src/app/api/contracts/generate-all/route.ts",
    "src/app/api/contracts/download-all/route.ts",
    "src/app/api/contracts/preview/route.ts",
    "src/app/api/queue/auto-match/route.ts",

    // ─── Cron jobs ───
    "src/app/api/cron/match-jobs/route.ts",
    "src/app/api/cron/check-expiry/route.ts",
    "src/app/api/cron/check-expiring-docs/route.ts",
    "src/app/api/cron/profile-reminders/route.ts",

    // ─── Brain API ───
    "src/app/api/brain/collect/route.ts",
    "src/app/api/brain/code/route.ts",
    "src/app/api/brain/report/route.ts",

    // ─── Auth ───
    "src/app/auth/callback/route.ts",
    "src/app/auth/signout/route.ts",

    // ─── Core libraries (ALL) ───
    "src/lib/supabase/admin.ts",
    "src/lib/supabase/server.ts",
    "src/lib/supabase/client.ts",
    "src/lib/supabase/middleware.ts",
    "src/lib/email-templates.ts",
    "src/lib/profile-completion.ts",
    "src/lib/gemini.ts",
    "src/lib/godmode.ts",
    "src/lib/user-management.ts",
    "src/lib/whatsapp.ts",
    "src/lib/notifications.ts",
    "src/lib/mailer.ts",
    "src/lib/stripe.ts",
    "src/lib/constants.ts",
    "src/lib/sanitize.ts",
    "src/lib/admin.ts",
    "src/lib/imageUtils.ts",
    "src/lib/pdf-generator.ts",
    "src/lib/pdf-templates/styles.ts",

    // ─── Config ───
    "vercel.json",
    "AGENTS.md",
    "package.json",
];

async function fetchFileFromGitHub(path: string, token: string): Promise<{ path: string; content: string } | null> {
    try {
        const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}?ref=${GITHUB_BRANCH}`;
        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github.v3.raw",
            },
        });

        if (!response.ok) return null;

        const content = await response.text();
        return { path, content };
    } catch {
        return null;
    }
}

export async function GET(request: NextRequest) {
    // Auth check
    const authHeader = request.headers.get("authorization");
    const expectedToken = process.env.CRON_SECRET;
    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
        return NextResponse.json({ error: "GITHUB_TOKEN not configured" }, { status: 500 });
    }

    // Fetch all key files in parallel
    const results = await Promise.all(
        KEY_PATHS.map(path => fetchFileFromGitHub(path, githubToken))
    );

    const files = results.filter(Boolean) as { path: string; content: string }[];

    // Format for AI consumption
    const codePayload = files.map(f => ({
        path: f.path,
        lines: f.content.split("\n").length,
        content: f.content,
    }));

    return NextResponse.json({
        repo: GITHUB_REPO,
        branch: GITHUB_BRANCH,
        filesRead: files.length,
        totalFiles: KEY_PATHS.length,
        totalLines: codePayload.reduce((sum, f) => sum + f.lines, 0),
        files: codePayload,
    });
}
