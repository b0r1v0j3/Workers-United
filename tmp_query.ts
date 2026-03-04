import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf-8');
const envVars = Object.fromEntries(
    envFile.split('\n').filter(line => line && !line.startsWith('#') && line.includes('=')).map(line => {
        const [key, ...rest] = line.split('=');
        return [key.trim(), rest.join('=').trim().replace(/^['"]|['"]$/g, '')];
    })
);

const supabaseUrl = envVars['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = envVars['SUPABASE_SERVICE_ROLE_KEY'];

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: reports, error: err1 } = await supabase.from('brain_reports').select('content, created_at, report_type').order('created_at', { ascending: false }).limit(1);
    console.log("=== LATEST BRAIN REPORT ===");
    if (err1) console.error("Error fetching reports:", err1);
    reports?.forEach(r => {
        console.log(`[${r.created_at}] Type: ${r.report_type}`);
        // parse safely if JSON
        try {
            console.log(JSON.stringify(typeof r.content === 'string' ? JSON.parse(r.content) : r.content, null, 2).substring(0, 3000));
        } catch (e) {
            console.log(r.content);
        }
    });

    const { data: actions, error: err3 } = await supabase.from('brain_actions').select('*').order('created_at', { ascending: false }).limit(5);
    console.log("\n=== RECENT BRAIN ACTIONS ===");
    if (err3) console.error("Error fetching actions:", err3);
    console.log(JSON.stringify(actions, null, 2));

    const { data: activities, error: err2 } = await supabase.from('user_activity').select('action, details, created_at, user_id').eq('status', 'error').order('created_at', { ascending: false }).limit(5);
    console.log("\n=== RECENT SYSTEM ERRORS ===");
    if (err2) console.error("Error fetching activities:", err2);
    console.log(JSON.stringify(activities, null, 2));

    const { data: waMsgs, error: err4 } = await supabase.from('whatsapp_messages').select('phone_number, direction, content, status, created_at').order('created_at', { ascending: false }).limit(10);
    console.log("\n=== RECENT WHATSAPP MESSAGES ===");
    if (err4) console.error("Error fetching WA:", err4);
    console.log(JSON.stringify(waMsgs, null, 2));
}
run();
