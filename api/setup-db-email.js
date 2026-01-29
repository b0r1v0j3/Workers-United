
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
    try {
        // 1. Create email_queue table
        await sql`
      CREATE TABLE IF NOT EXISTS email_queue (
        id SERIAL PRIMARY KEY,
        candidate_id INT,
        candidate_email VARCHAR(200) NOT NULL,
        candidate_name VARCHAR(200),
        email_type VARCHAR(50) NOT NULL,
        send_at TIMESTAMP NOT NULL,
        sent BOOLEAN DEFAULT FALSE,
        sent_at TIMESTAMP,
        error TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;

        // 2. Create index
        await sql`
      CREATE INDEX IF NOT EXISTS idx_email_queue_pending 
      ON email_queue(send_at, sent) 
      WHERE sent = FALSE;
    `;

        // 3. Create employers table
        await sql`
      CREATE TABLE IF NOT EXISTS employers (
        id SERIAL PRIMARY KEY,
        email VARCHAR(200) UNIQUE NOT NULL,
        name VARCHAR(200),
        company_name VARCHAR(200),
        location VARCHAR(200),
        workers_needed INT,
        industry VARCHAR(100),
        work_type VARCHAR(200),
        start_date VARCHAR(100),
        provides_housing BOOLEAN,
        phone VARCHAR(50),
        status VARCHAR(20) DEFAULT 'NEW',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;

        return res.status(200).json({ message: 'Tables created successfully' });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
