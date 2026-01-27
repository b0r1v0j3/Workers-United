import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
    try {
        // Add created_at and updated_at columns to documents table
        await sql`
            ALTER TABLE documents 
            ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()
        `;

        // Drop old uploaded_at column if it exists
        await sql`ALTER TABLE documents DROP COLUMN IF EXISTS uploaded_at`;

        return res.status(200).json({
            success: true,
            message: 'Documents table migrated successfully'
        });
    } catch (error) {
        console.error('Migration Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
