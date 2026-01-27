
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
    // Basic security: only allow this to run with the Admin Token or a secret check
    // For initial setup, we might leave it open or check x-auth-token like other admin routes
    // But for now, let's keep it simple as a setup script.

    try {
        // 1. Create Candidates Table
        await sql`
            CREATE TABLE IF NOT EXISTS candidates (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                email TEXT UNIQUE NOT NULL,
                name TEXT,
                phone TEXT,
                country TEXT,
                role TEXT,
                job_preference TEXT,
                status TEXT DEFAULT 'NEW',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `;

        // 2. Create Documents Table
        await sql`
            CREATE TABLE IF NOT EXISTS documents (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
                file_url TEXT NOT NULL,
                file_type TEXT NOT NULL,
                uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `;

        // 3. Create Audit Logs
        await sql`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                candidate_id UUID REFERENCES candidates(id) ON DELETE SET NULL,
                action TEXT NOT NULL,
                performed_by TEXT,
                details JSONB,
                timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `;

        // 4. Create Indexes
        // Note: CREATE INDEX IF NOT EXISTS works in Postgres 9.5+
        // Vercel Postgres is usually recent enough.
        await sql`CREATE INDEX IF NOT EXISTS idx_candidates_email ON candidates(email);`;
        await sql`CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(status);`;

        return res.status(200).json({ message: 'Database schema initialized successfully' });
    } catch (error) {
        // If "uuid_generate_v4" does not exist, we need to enable the extension
        if (error.message.includes('uuid_generate_v4')) {
            try {
                await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`;
                return res.status(200).json({ message: 'Extension uuid-ossp created. Please run this script again to create tables.' });
            } catch (extError) {
                return res.status(500).json({ error: 'Failed to create extension: ' + extError.message });
            }
        }
        return res.status(500).json({ error: error.message });
    }
}
