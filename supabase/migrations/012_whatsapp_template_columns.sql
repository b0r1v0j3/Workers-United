-- Migration: Add WhatsApp template tracking columns to whatsapp_messages
-- Required for Meta Cloud API integration (template_name, wamid, error_message)

-- Add template_name column for tracking which template was sent
ALTER TABLE public.whatsapp_messages
ADD COLUMN IF NOT EXISTS template_name TEXT;

-- Add wamid (WhatsApp Message ID) for delivery tracking
ALTER TABLE public.whatsapp_messages
ADD COLUMN IF NOT EXISTS wamid TEXT;

-- Add error_message for debugging failed sends
ALTER TABLE public.whatsapp_messages
ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Update status CHECK to include 'read' (Meta reports read receipts)
ALTER TABLE public.whatsapp_messages DROP CONSTRAINT IF EXISTS whatsapp_messages_status_check;
ALTER TABLE public.whatsapp_messages ADD CONSTRAINT whatsapp_messages_status_check
    CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed'));

-- Index on wamid for webhook status updates (Meta sends delivery/read callbacks)
CREATE INDEX IF NOT EXISTS idx_whatsapp_wamid ON public.whatsapp_messages(wamid);
