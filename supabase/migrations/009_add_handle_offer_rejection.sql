-- Migration: Add handle_offer_rejection RPC
-- This function exists in phase6-extensions.sql but was never in a migration
-- Required by: offers/route.ts (decline action)

CREATE OR REPLACE FUNCTION handle_offer_rejection(p_offer_id UUID)
RETURNS VOID AS $$
DECLARE
    offer_rec RECORD;
    candidate_rec RECORD;
    max_position INTEGER;
BEGIN
    -- Get offer details
    SELECT * INTO offer_rec FROM offers WHERE id = p_offer_id;
    IF NOT FOUND THEN RETURN; END IF;
    
    -- Get candidate
    SELECT * INTO candidate_rec FROM candidates WHERE id = offer_rec.candidate_id;
    IF NOT FOUND THEN RETURN; END IF;
    
    -- Increment rejection count
    UPDATE candidates 
    SET rejection_count = rejection_count + 1,
        refund_eligible = FALSE
    WHERE id = offer_rec.candidate_id;
    
    -- Check if this is 2nd rejection
    IF candidate_rec.rejection_count + 1 >= 2 THEN
        -- Mark as rejected twice
        UPDATE candidates 
        SET status = 'REJECTED_TWICE',
            queue_position = NULL,
            entry_fee_paid = FALSE
        WHERE id = offer_rec.candidate_id;
    ELSE
        -- Move to bottom of queue
        SELECT COALESCE(MAX(queue_position), 0) + 1 INTO max_position
        FROM candidates WHERE entry_fee_paid = TRUE;
        
        UPDATE candidates 
        SET status = 'IN_QUEUE',
            queue_position = max_position
        WHERE id = offer_rec.candidate_id;
    END IF;
    
    -- Mark offer as expired
    UPDATE offers 
    SET status = 'expired'
    WHERE id = p_offer_id;
END;
$$ LANGUAGE plpgsql;

-- Verify
SELECT proname FROM pg_proc WHERE proname = 'handle_offer_rejection';
