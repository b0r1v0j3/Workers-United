-- Email Queue System for Automated Sequences
-- Run this in Vercel Postgres

-- Email Queue Table
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

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_email_queue_pending 
ON email_queue(send_at, sent) 
WHERE sent = FALSE;

-- Employers Table
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

-- Payments Table (for Stripe)
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  candidate_id INT,
  candidate_email VARCHAR(200),
  stripe_session_id VARCHAR(200),
  stripe_payment_intent VARCHAR(200),
  amount_cents INT DEFAULT 900,
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(20) DEFAULT 'PENDING',
  refund_eligible_until DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  paid_at TIMESTAMP
);

-- Email Types Reference:
-- 'welcome'         - Sent immediately on signup
-- 'review_complete' - Sent 24h after signup (auto: "we reviewed your profile")
-- 'docs_reminder'   - Sent if docs not submitted after 48h
-- 'docs_approved'   - Sent 48h after docs submitted (auto: "docs look good")
-- 'payment_request' - Sent after docs approved (please pay $9)
-- 'payment_confirm' - Sent after payment received
-- 'job_offer'       - Sent when job match found
