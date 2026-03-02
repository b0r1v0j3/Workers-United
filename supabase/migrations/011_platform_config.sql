-- Migration: Create platform_config table for centralized business facts
-- All systems (WhatsApp bot, Brain Monitor, n8n AI) read from this single source of truth

CREATE TABLE IF NOT EXISTS platform_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_platform_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER platform_config_updated
  BEFORE UPDATE ON platform_config
  FOR EACH ROW EXECUTE FUNCTION update_platform_config_timestamp();

-- Seed business facts
INSERT INTO platform_config (key, value, description) VALUES
  ('entry_fee', '$9', 'Application fee amount'),
  ('entry_fee_currency', 'USD', 'Currency for entry fee'),
  ('refund_period_days', '90', 'Days before refund eligibility'),
  ('refund_policy_en', 'If you do not receive a job offer within 90 days, your fee is fully refunded.', 'Refund policy (English)'),
  ('refund_policy_sr', 'Ukoliko ne dobijete ponudu za posao u roku od 90 dana, vaš novac će biti vraćen.', 'Refund policy (Serbian)'),
  ('placement_fee_serbia', '$190', 'Placement fee for Serbia'),
  ('website_url', 'workersunited.eu', 'Main website URL'),
  ('contact_email', 'contact@workersunited.eu', 'Contact email'),
  ('platform_name', 'Workers United', 'Platform display name'),
  ('supported_documents', 'passport, diploma, biometric photo', 'Required documents for workers'),
  ('processing_time', '2-8 weeks depending on country', 'Expected visa processing time'),
  ('bot_greeting_en', 'Welcome to Workers United! 🌍 We help workers find jobs in Europe and handle all visa paperwork.', 'Bot greeting (English)'),
  ('bot_greeting_sr', 'Dobrodošli u Workers United! 🌍 Pomažemo radnicima da nađu posao u Evropi.', 'Bot greeting (Serbian)'),
  ('employer_fee', 'Free — always', 'Fee for employers')
ON CONFLICT (key) DO NOTHING;

-- RLS: everyone can read, only admins can write
ALTER TABLE platform_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read config" ON platform_config
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage config" ON platform_config
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND user_type = 'admin')
  );
