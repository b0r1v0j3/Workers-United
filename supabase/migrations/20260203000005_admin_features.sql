-- Extend Payments Table for Refund Tracking
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS refund_status TEXT DEFAULT 'none' CHECK (refund_status IN ('none', 'requested', 'completed', 'rejected')),
ADD COLUMN IF NOT EXISTS refund_notes TEXT;

-- Update Admin View to include more details for the dashboard
CREATE OR REPLACE VIEW public.admin_candidate_summary AS
SELECT 
    p.id as user_id,
    p.email,
    p.full_name,
    cr.is_ready as documents_verified,
    cr.verified_docs_count,
    pay.paid_at,
    pay.refund_status,
    pay.amount as paid_amount,
    -- Calculate days left in 90-day guarantee
    CASE 
        WHEN pay.paid_at IS NOT NULL THEN 
            GREATEST(0, 90 - DATE_PART('day', now() - pay.paid_at))
        ELSE NULL 
    END as days_left
FROM public.profiles p
LEFT JOIN public.candidate_readiness cr ON p.id = cr.user_id
LEFT JOIN public.payments pay ON p.id = pay.user_id
WHERE p.role = 'candidate';
