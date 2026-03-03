import fs from 'fs';

// Parse .env.local 
const env = {};
fs.readFileSync('.env.local', 'utf-8').split('\n').forEach(l => {
    const c = l.replace(/\r$/, '');
    const m = c.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim();
});

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const headers = { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY };

async function run() {
    console.log("🧠 MANUAL BRAIN ANALYSIS");
    console.log("========================\n");

    // === 1. ROUTE HEALTH ===
    console.log("=== 🔧 ROUTE HEALTH ===");
    const routes = ["/login", "/signup", "/auth/callback", "/api/health"];
    for (const route of routes) {
        const start = Date.now();
        try {
            const res = await fetch(`https://workersunited.eu${route}`, {
                method: "GET", redirect: "manual", signal: AbortSignal.timeout(10000)
            });
            const ok = res.status < 500;
            console.log(`  ${ok ? "✅" : "❌"} ${route} → ${res.status} (${Date.now() - start}ms)`);
        } catch (e) {
            console.log(`  ❌ ${route} → FAILED: ${e.message} (${Date.now() - start}ms)`);
        }
    }

    // === 2. AUTH HEALTH ===
    console.log("\n=== 🔐 AUTH HEALTH ===");
    const usersRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=500`, { headers });
    const usersData = await usersRes.json();
    const users = usersData.users || [];

    const unconfirmed = users.filter(u => !u.email_confirmed_at);
    const noType = users.filter(u => !u.user_metadata?.user_type);
    const workers = users.filter(u => u.user_metadata?.user_type === "worker");

    console.log(`  Total auth users: ${users.length}`);
    console.log(`  Workers: ${workers.length}`);
    console.log(`  Unconfirmed emails: ${unconfirmed.length}`);
    if (unconfirmed.length > 0) {
        unconfirmed.forEach(u => {
            const days = Math.floor((Date.now() - new Date(u.created_at).getTime()) / (1000 * 60 * 60 * 24));
            console.log(`    ⚠️  ${u.email} — unconfirmed for ${days} days`);
        });
    }
    console.log(`  No user_type metadata: ${noType.length}`);
    if (noType.length > 0) noType.forEach(u => console.log(`    ⚠️  ${u.email}`));

    // === 3. PROFILES + CANDIDATES ===
    console.log("\n=== 📋 RECORD INTEGRITY ===");
    const profilesRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id,user_type,full_name`, { headers });
    const profiles = await profilesRes.json();
    const profileIds = new Set(profiles.map(p => p.id));

    const candidatesRes = await fetch(`${SUPABASE_URL}/rest/v1/candidates?select=id,profile_id,status,admin_approved,entry_fee_paid,phone,nationality`, { headers });
    const candidates = await candidatesRes.json();
    const candidateProfileIds = new Set(candidates.map(c => c.profile_id));

    const workersWithoutProfile = workers.filter(u => !profileIds.has(u.id));
    const workersWithoutCandidate = workers.filter(u => !candidateProfileIds.has(u.id));

    console.log(`  Profiles: ${profiles.length}`);
    console.log(`  Candidates: ${candidates.length}`);
    console.log(`  Workers WITHOUT profile: ${workersWithoutProfile.length}`);
    if (workersWithoutProfile.length > 0) workersWithoutProfile.forEach(u => console.log(`    ❌ ${u.email}`));
    console.log(`  Workers WITHOUT candidate: ${workersWithoutCandidate.length}`);
    if (workersWithoutCandidate.length > 0) workersWithoutCandidate.forEach(u => console.log(`    ❌ ${u.email}`));

    // === 4. FUNNEL STALLS ===
    console.log("\n=== 📊 FUNNEL STALLS ===");
    const docsRes = await fetch(`${SUPABASE_URL}/rest/v1/candidate_documents?select=document_type,status`, { headers });
    const docs = await docsRes.json();

    const newCandidates = candidates.filter(c => c.status === "NEW");
    const withNoPhone = candidates.filter(c => !c.phone);
    const withNoNationality = candidates.filter(c => !c.nationality);
    const pendingDocs = docs.filter(d => d.status === "pending" || d.status === "verifying");
    const approvedNotPaid = candidates.filter(c => c.admin_approved && !c.entry_fee_paid);

    console.log(`  NEW status (haven't progressed): ${newCandidates.length}`);
    console.log(`  No phone number: ${withNoPhone.length}`);
    console.log(`  No nationality: ${withNoNationality.length}`);
    console.log(`  Docs pending verification: ${pendingDocs.length}`);
    console.log(`  Approved but not paid: ${approvedNotPaid.length}`);

    // === 5. EMAIL HEALTH ===
    console.log("\n=== 📧 EMAIL HEALTH ===");
    const emailsRes = await fetch(`${SUPABASE_URL}/rest/v1/email_queue?select=id,email_type,status,error_message,recipient,created_at&order=created_at.desc&limit=200`, { headers });
    const emails = await emailsRes.json();

    const sent = emails.filter(e => e.status === "sent").length;
    const failed = emails.filter(e => e.status === "failed");
    const pending = emails.filter(e => e.status === "pending").length;

    console.log(`  Total (recent): ${emails.length}`);
    console.log(`  Sent: ${sent}`);
    console.log(`  Failed: ${failed.length}`);
    console.log(`  Pending: ${pending}`);
    if (failed.length > 0) {
        console.log("  Failed emails:");
        const bouncePatterns = {};
        failed.forEach(e => {
            const domain = e.recipient?.split("@")[1]?.toLowerCase();
            if (domain) bouncePatterns[domain] = (bouncePatterns[domain] || 0) + 1;
            console.log(`    ❌ ${e.email_type} → ${e.recipient} — ${(e.error_message || "no error msg").substring(0, 100)}`);
        });
        if (Object.keys(bouncePatterns).length > 0) {
            console.log("  Bounce patterns:");
            Object.entries(bouncePatterns).sort((a, b) => b[1] - a[1]).forEach(([d, c]) => console.log(`    ${d}: ${c} failures`));
        }
    }

    // === 6. SUSPICIOUS EMAILS ===
    console.log("\n=== 🔍 SUSPICIOUS EMAILS IN AUTH ===");
    const KNOWN_TYPOS = { "gmai.com": "gmail.com", "gmial.com": "gmail.com", "yahoo.coms": "yahoo.com", "hotmai.com": "hotmail.com", "1yahoo.com": "yahoo.com", "1gmail.com": "gmail.com", "gmail.co": "gmail.com", "gmail.con": "gmail.com", "yahoo.co": "yahoo.com" };
    let suspicious = 0;
    users.forEach(u => {
        if (!u.email) return;
        const domain = u.email.split("@")[1]?.toLowerCase();
        if (KNOWN_TYPOS[domain]) {
            console.log(`  ⚠️  ${u.email} — probable typo, should be @${KNOWN_TYPOS[domain]}`);
            suspicious++;
        }
        if (u.email.endsWith(".")) {
            console.log(`  ⚠️  ${u.email} — trailing dot`);
            suspicious++;
        }
    });
    if (suspicious === 0) console.log("  ✅ No suspicious emails found");

    // === SUMMARY ===
    console.log("\n=== 🧠 SUMMARY ===");
    const issues = [];
    if (unconfirmed.length > 0) issues.push(`🔴 ${unconfirmed.length} unconfirmed emails`);
    if (workersWithoutProfile.length > 0) issues.push(`🔴 ${workersWithoutProfile.length} workers without profile`);
    if (workersWithoutCandidate.length > 0) issues.push(`🔴 ${workersWithoutCandidate.length} workers without candidate record`);
    if (failed.length > 0) issues.push(`🟡 ${failed.length} failed emails`);
    if (withNoPhone.length > 0) issues.push(`🟡 ${withNoPhone.length} candidates without phone`);
    if (approvedNotPaid.length > 0) issues.push(`🟡 ${approvedNotPaid.length} approved but not paid`);
    if (suspicious > 0) issues.push(`🟡 ${suspicious} suspicious email addresses`);

    if (issues.length === 0) {
        console.log("  ✅ No critical issues found!");
    } else {
        issues.forEach(i => console.log(`  ${i}`));
    }
}

run().catch(e => console.error("Fatal:", e));
