-- Extend Payments Table for Webhook Support
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'find_job_activation',
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;

-- Ensure idempotency by making stripe_checkout_session_id unique
-- We use a DO block to avoid errors if the constraint already exists
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payments_stripe_checkout_session_id_key'
    ) THEN
        ALTER TABLE public.payments ADD CONSTRAINT payments_stripe_checkout_session_id_key UNIQUE (stripe_checkout_session_id);
    END IF;
END $$;

-- Update status check if necessary (already includes 'completed' which we will use)
-- No changes needed to the check constraint for status as per core_schema.
