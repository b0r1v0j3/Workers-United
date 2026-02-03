// Run SQL on Supabase database - Direct client config
const { readFileSync } = require('fs');
const { Client } = require('pg');

async function runSQL() {
    // Using explicit config instead of connection string to avoid URL encoding issues
    const client = new Client({
        host: 'aws-0-eu-central-1.pooler.supabase.com',
        port: 5432,  // Session mode
        database: 'postgres',
        user: 'postgres.qdwhwlusxjjtlinmpwms',
        password: 'Borivoje19.10.1992.',
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('Connecting to Supabase...');
        await client.connect();
        console.log('Connected!');

        const sql = readFileSync('./supabase/FULL_SETUP.sql', 'utf8');
        console.log('Running SQL migration (this takes ~30 seconds)...');

        await client.query(sql);

        console.log('');
        console.log('=========================================');
        console.log('✅ SUCCESS! All tables created!');
        console.log('=========================================');
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.end();
    }
}

runSQL();
