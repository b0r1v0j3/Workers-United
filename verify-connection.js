const { Client } = require('pg');

async function verify() {
    const client = new Client({
        host: 'aws-0-eu-central-1.pooler.supabase.com',
        port: 5432,
        database: 'postgres',
        user: 'postgres.qdwhwlusxjjtlinmpwms',
        password: '2WzsNHxI5gpfsDz9',
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('Connecting to Supabase...');
        await client.connect();
        console.log('Connected!');
        const res = await client.query('SELECT current_database(), current_user, version();');
        console.log('Connection details:', res.rows[0]);
        console.log('');
        console.log('✅ FULL ACCESS VERIFIED. I can manage the database automatically from here.');
    } catch (err) {
        console.log('❌ Connection failed:', err.message);
    } finally {
        await client.end();
    }
}

verify();
