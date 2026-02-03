const { Client } = require('pg');

const sql = `
DROP TABLE IF EXISTS contract_data CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS offers CASCADE;
DROP TABLE IF EXISTS job_requests CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS employers CASCADE;
DROP TABLE IF EXISTS candidates CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    user_type TEXT DEFAULT 'candidate',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'NEW',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE employers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    company_name TEXT DEFAULT 'My Company',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID REFERENCES candidates(id),
    employer_id UUID REFERENCES employers(id),
    status TEXT DEFAULT 'PENDING'
);

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES profiles(id),
    payment_type TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    status TEXT DEFAULT 'pending'
);

CREATE TABLE job_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employer_id UUID REFERENCES employers(id),
    title TEXT NOT NULL,
    status TEXT DEFAULT 'open'
);

CREATE TABLE offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_request_id UUID REFERENCES job_requests(id),
    candidate_id UUID REFERENCES candidates(id),
    status TEXT DEFAULT 'pending'
);

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID REFERENCES candidates(id),
    document_type TEXT NOT NULL,
    file_url TEXT NOT NULL,
    verification_status TEXT DEFAULT 'pending'
);

CREATE TABLE contract_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID REFERENCES matches(id)
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE employers ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all" ON profiles FOR ALL USING (true);
CREATE POLICY "allow_all" ON candidates FOR ALL USING (true);
CREATE POLICY "allow_all" ON employers FOR ALL USING (true);
CREATE POLICY "allow_all" ON matches FOR ALL USING (true);
CREATE POLICY "allow_all" ON payments FOR ALL USING (true);
CREATE POLICY "allow_all" ON job_requests FOR ALL USING (true);
CREATE POLICY "allow_all" ON offers FOR ALL USING (true);
CREATE POLICY "allow_all" ON documents FOR ALL USING (true);
CREATE POLICY "allow_all" ON contract_data FOR ALL USING (true);

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, user_type)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', COALESCE(NEW.raw_user_meta_data->>'user_type', 'candidate'));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
`;

async function run() {
    // Try multiple connection formats
    const configs = [
        {
            name: 'Direct Database Host',
            host: 'db.qdwhwlusxjjtlinmpwms.supabase.co',
            port: 5432,
            database: 'postgres',
            user: 'postgres',
            password: '2WzsNHxI5gpfsDz9',
            ssl: { rejectUnauthorized: false }
        },
        {
            name: 'Session Pooler',
            host: 'aws-0-eu-central-1.pooler.supabase.com',
            port: 5432,
            database: 'postgres',
            user: 'postgres.qdwhwlusxjjtlinmpwms',
            password: '2WzsNHxI5gpfsDz9',
            ssl: { rejectUnauthorized: false }
        },
        {
            name: 'Transaction Pooler',
            host: 'aws-0-eu-central-1.pooler.supabase.com',
            port: 6543,
            database: 'postgres',
            user: 'postgres.qdwhwlusxjjtlinmpwms',
            password: '2WzsNHxI5gpfsDz9',
            ssl: { rejectUnauthorized: false }
        }
    ];

    for (const config of configs) {
        console.log(`Trying: ${config.name}...`);
        const client = new Client(config);

        try {
            await client.connect();
            console.log('Connected! Running SQL...');
            await client.query(sql);
            console.log('');
            console.log('✅ SUCCESS! All tables created!');
            await client.end();
            return;
        } catch (err) {
            console.log(`Failed: ${err.message}`);
            try { await client.end(); } catch (e) { }
        }
    }

    console.log('');
    console.log('All methods failed. Please run SQL manually.');
}

run();
