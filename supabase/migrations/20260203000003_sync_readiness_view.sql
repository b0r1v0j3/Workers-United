-- Sync Candidate Readiness View with new status column
CREATE OR REPLACE VIEW public.candidate_readiness AS
SELECT 
    p.id as user_id,
    p.full_name,
    p.email,
    COUNT(cd.id) FILTER (WHERE (cd.status = 'verified' OR cd.verification_status = 'verified') AND cd.document_type IN ('passport', 'photo', 'diploma')) as verified_docs_count,
    CASE 
        WHEN COUNT(cd.id) FILTER (WHERE (cd.status = 'verified' OR cd.verification_status = 'verified') AND cd.document_type IN ('passport', 'photo', 'diploma')) >= 3 THEN true
        ELSE false
    END as is_ready
FROM public.profiles p
LEFT JOIN public.candidate_documents cd ON p.id = cd.candidate_id
WHERE p.role = 'candidate'
GROUP BY p.id, p.full_name, p.email;
