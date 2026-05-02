# Workers United — Claude Code Project Context

Shared Claude Code project context for this repository. Keep this file tracked; local Claude session state belongs in `.claude/`, which is gitignored.

## Quick Reference
- **Stack**: Next.js 16 (Turbopack) + Supabase + Stripe + WhatsApp Cloud API + Claude Sonnet 4.6
- **Deploy**: Vercel (auto-deploy on push to main)
- **DB**: Supabase (Postgres + Auth + Storage, eu-north-1)
- **Credentials**: All in `.env.local` (gitignored)
- **Full architecture docs**: Read `AGENTS.md` for complete project documentation

## What This Is
Job placement platform connecting international workers with European employers.
Workers sign up, complete profile + documents, pay $9, enter matching queue.
WhatsApp bot (Claude-powered) handles inbound conversations in 6+ languages.

## Key Services & API Keys (all in .env.local)
- **WhatsApp Cloud API**: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID
- **Claude/Anthropic**: ANTHROPIC_API_KEY — powers WhatsApp conversations + image analysis
- **OpenAI**: OPENAI_API_KEY — powers intent classification (GPT-5 mini) + voice transcription (Whisper)
- **Stripe**: STRIPE_SECRET_KEY (live); checkout products/prices are configured in Stripe and referenced by the app
- **Supabase**: SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL
- **SMTP**: workers.united.eu@gmail.com via SMTP_USER/SMTP_PASS
- **Owner alerts / god mode**: OWNER_EMAIL
- **Meta**: META_APP_SECRET for webhook signature verification

## WhatsApp Bot Architecture
1. Meta webhook → `src/app/api/whatsapp/webhook/route.ts`
2. Intent classification: OpenAI GPT-5 mini (fast/cheap) → `src/lib/whatsapp-worker-ai.ts`
3. Conversation: Claude Sonnet 4.6 (natural tone) → same file
4. Voice: Whisper transcription → `src/lib/whatsapp-media.ts`
5. Images: Claude Vision analysis → same file
6. Employer flow: `src/lib/whatsapp-employer-flow.ts`
7. Self-improvement: Daily cron analyzes conversations → `src/lib/whatsapp-self-improve.ts`
8. Brain memory: `brain_memory` table for learned facts, `brain_reports` for analysis reports

## MCP Integrations Available
- Supabase MCP: Direct SQL access to production DB
- Vercel MCP: Deployment logs, runtime logs, project management
- Stripe MCP: Payment intents, customers, products, API execution
- Sentry, Linear, Gmail, Google Calendar, Figma, Chrome also connected

## Owner Preferences (from AGENTS.md)
- Always suggest improvements — be a development partner, not just executor
- Fix inconsistencies proactively across forms/flows
- Never implement features halfway
- Update AGENTS.md after significant architecture changes
- Site is in English, AGENTS.md is in Serbian
- Keyword `REVIZIJA` = full daily ops sweep

## Build & Test
```bash
npx next build          # TypeScript compilation check (MUST pass before push)
npx vitest run          # All tests (511 currently)
```

## Sending WhatsApp Messages Directly
```bash
curl -s -X POST "https://graph.facebook.com/v21.0/$WHATSAPP_PHONE_NUMBER_ID/messages" \
  -H "Authorization: Bearer $WHATSAPP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"messaging_product":"whatsapp","to":"PHONE","type":"text","text":{"body":"MESSAGE"}}'
```
Then INSERT into whatsapp_messages table via Supabase MCP.
