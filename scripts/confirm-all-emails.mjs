// Confirm ALL unconfirmed user emails via Supabase Admin API
// Usage: node scripts/confirm-all-emails.mjs

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Read .env.local manually
import { readFileSync } from "fs";
const envFile = readFileSync(".env.local", "utf-8");
const env = {};
for (const line of envFile.split("\n")) {
    const clean = line.replace(/\r$/, "");
    const match = clean.match(/^([^#=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim();
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
    console.error("Missing env vars in .env.local");
    process.exit(1);
}

// Use fetch directly against Supabase Auth Admin API
async function listUsers(page = 1, perPage = 100) {
    const res = await fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=${perPage}`, {
        headers: {
            "Authorization": `Bearer ${key}`,
            "apikey": key,
        },
    });
    if (!res.ok) throw new Error(`List users failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return data.users || [];
}

async function confirmUser(userId) {
    const res = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
        method: "PUT",
        headers: {
            "Authorization": `Bearer ${key}`,
            "apikey": key,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ email_confirm: true }),
    });
    if (!res.ok) throw new Error(`Confirm failed for ${userId}: ${res.status}`);
    return res.json();
}

async function main() {
    console.log("Fetching all users...\n");

    let allUsers = [];
    let page = 1;
    while (true) {
        const users = await listUsers(page, 1000);
        allUsers.push(...users);
        if (users.length < 1000) break;
        page++;
    }

    const unconfirmed = allUsers.filter(u => !u.email_confirmed_at);

    console.log(`Total users: ${allUsers.length}`);
    console.log(`Unconfirmed: ${unconfirmed.length}\n`);

    if (unconfirmed.length === 0) {
        console.log("All users are already confirmed!");
        return;
    }

    for (const user of unconfirmed) {
        try {
            await confirmUser(user.id);
            console.log(`✅ Confirmed: ${user.email} (${user.id})`);
        } catch (err) {
            console.error(`❌ Failed: ${user.email} — ${err.message}`);
        }
    }

    console.log("\nDone!");
}

main();
