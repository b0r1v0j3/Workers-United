const { Client } = require('pg');

async function check() {
    // Transaction Mode (Port 6543)
    const connectionString = 'postgresql://postgres.qdwhwlusxjjtlinmpwms:2WzsNHxI5gpfsDz9@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=no-verify';

    const client = new Client({ connectionString });

    try {
        console.log('Testing connection...');
        await client.connect();
        console.log('✅ Connection Successful!');
        const res = await client.query('SELECT 1');
        console.log('Query result:', res.rows[0]);
    } catch (err) {
        console.log('❌ Connection Failed:', err.message);
    } finally {
        await client.end();
    }
}

check();
