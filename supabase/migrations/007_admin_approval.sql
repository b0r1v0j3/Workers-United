-- ================================================================
-- MANUAL ADMIN APPROVAL FOR WORKERS AND EMPLOYERS
-- Workers must be approved by admin before they can pay $9
-- Employers must be approved before activation
-- ================================================================

-- 1. Add admin approval columns to candidates
ALTER TABLE public.candidates 
ADD COLUMN IF NOT EXISTS admin_approved BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS admin_approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS admin_approved_by UUID REFERENCES profiles(id);

-- 2. Add admin approval columns to employers
ALTER TABLE public.employers
ADD COLUMN IF NOT EXISTS admin_approved BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS admin_approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS admin_approved_by UUID REFERENCES profiles(id);

-- 3. Update candidates status constraint to include PENDING_APPROVAL
ALTER TABLE public.candidates DROP CONSTRAINT IF EXISTS candidates_status_check;
ALTER TABLE public.candidates ADD CONSTRAINT candidates_status_check
CHECK (status IN (
    'NEW',                    -- Just signed up
    'PROFILE_COMPLETE',       -- Profile filled, not paid
    'PENDING_APPROVAL',       -- Profile complete, waiting for admin approval
    'IN_QUEUE',              -- Paid $9, waiting for match
    'OFFER_PENDING',         -- Has active offer, 24h countdown
    'OFFER_ACCEPTED',        -- Paid $190, waiting for visa process
    'VISA_PROCESS_STARTED',  -- Visa application in progress
    'VISA_APPROVED',         -- Visa granted
    'PLACED',                -- Successfully employed
    'REJECTED',              -- Application rejected
    'REFUND_FLAGGED'         -- 90 days without match, flagged for refund
));

-- 4. Index for quick filtering in admin panel
CREATE INDEX IF NOT EXISTS idx_candidates_pending_approval 
ON candidates(admin_approved) WHERE admin_approved = FALSE;

CREATE INDEX IF NOT EXISTS idx_employers_pending_approval 
ON employers(admin_approved) WHERE admin_approved = FALSE;
