-- Unified Admin Overview View
CREATE OR REPLACE VIEW public.admin_candidate_full_overview AS
SELECT 
    p.id as user_id,
    p.email,
    p.full_name,
    p.role,
    cr.is_ready,
    cr.verified_count as verified_docs_count,
    pc.paid_at,
    pc.deadline_at,
    pc.days_left,
    pc.payment_status,
    pc.refund_status,
    pc.refund_notes
FROM public.profiles p
LEFT JOIN public.candidate_readiness cr ON p.id = cr.user_id
LEFT JOIN public.admin_payment_countdown pc ON p.id = pc.user_id
WHERE p.role = 'candidate';
