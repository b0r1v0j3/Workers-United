---
description: Full project architecture reference — tech stack, folder structure, data flow, key files, new-feature checklist, and common gotchas. Read this at the start of every chat.
---

# Workers United — Project Architecture

> **Source of truth:** `AGENTS.md` (business rules, design rules, TODO, env vars, setup)
> This file covers the **technical** side only. Always consult `AGENTS.md` for business context.

---

## 1. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | **Next.js 16** (App Router) | TypeScript, React 19; production build now enforces TS errors again (no `ignoreBuildErrors`) |
| Styling | **Tailwind CSS v4** + `globals.css` | PostCSS via `@tailwindcss/postcss` |
| Font | **Montserrat** (Google Fonts) | Loaded in `src/app/layout.tsx` via `next/font` |
| Auth | **Supabase Auth** | Email/password, Google OAuth, password reset; live auth triggers now keep `profiles` + canonical `workers`/`employers` in sync on both signup and later metadata role updates, without depending on the retired `candidates` alias, while `/login` now finishes hash-based confirm/magic-link/recovery sessions and hands post-auth redirecting to a shared resolver. A shared auth-contact sync layer now mirrors canonical worker/employer phones back into the Auth `phone` field and metadata during self-service saves, admin edits, agency-managed claimed-worker edits, and post-login self-heal passes. |
| Database | **Supabase (PostgreSQL)** | RLS policies, cron-triggered functions, in-platform messaging tables (`conversations*`); worker app-layer runtime reads/writes through `worker_onboarding` / `worker_documents`, live Supabase physically uses `workers` / `worker_documents`, `documents / matches / offers` carry only canonical `worker_id` FKs, `contract_data` worker overrides are `worker_*`, and the live public schema no longer exposes the old `candidates` / `candidate_documents` aliases |
| Storage | **Supabase Storage** | Canonical and only active worker document bucket is `worker-docs`; runtime helpers resolve only `worker-docs`, while legacy `candidate-docs` and empty `documents` buckets are retired |
| Payments | **Stripe** | Checkout Sessions + Webhooks; checkout now reuses/prefills Stripe Customers from canonical worker/agency payment identity data, queue/payment UX explicitly reminds workers to use the same cardholder/billing details their bank expects, and webhook failure telemetry stores issuer/Radar decline context plus billing/card country hints (`payment_intent.payment_failed`, `charge.failed`, `checkout.session.expired`, `checkout.session.completed`) back into `payments.metadata` + `user_activity` so internal ops and analytics can split bank declines from Stripe risk blocks, checkout expiry, and market-specific patterns |
| AI | **OpenAI GPT-4o-mini** + **Gemini fallback** | Document verification uses GPT primary vision, with Gemini fallback chain (`3.0-flash → 2.5-pro → 2.5-flash`) |
| AI (Chatbot) | **GPT-5 mini + GPT-5.4 mini** | WhatsApp AI now uses a small intent router + richer response model flow with shorter context windows, shared canonical facts/rules from `src/lib/whatsapp-brain.ts`, shared live quality/handoff heuristics from `src/lib/whatsapp-quality.ts`, canonical `workerRecord` runtime naming, deterministic worker flows for the most common status/docs/payment/support questions, honest support auto-handoff into the real inbox for repeated paid-worker confusion, deterministic human greeting handling for both plain first-contact hellos and warmer small-talk openers like `hello how are you` / `zdravo kako si danas`, plus a conversation-aware language resolver and explicit language-switch detector so short follow-ups and direct `write in Serbian/French/Hindi` requests stay in the user's chosen language across `English / Serbian / Arabic / French / Portuguese / Hindi` |
| AI (Brain) | **GPT-5 mini + deterministic ops monitor** | `/api/brain/improve` still uses GPT-5 mini for low-risk conversation learnings, while the daily `/api/cron/brain-monitor` run is now an ops-first deterministic sweep powered by `src/lib/ops-monitor.ts`; every run is stored in `brain_reports`, email is sent only for critical/high ops signals, failure runs are saved instead of blasting raw crash mail, and technical monitoring surfaces now live behind the owner-only `/internal` hub instead of the business admin shell |
| Email | **Nodemailer** + Google Workspace SMTP | `contact@workersunited.eu` |
| Hosting | **Vercel** | Cron jobs configured in `vercel.json` |
| Icons | **Lucide React** | — |
| WhatsApp | **Meta Cloud API v21.0** | Template messages, AI chatbot, delivery tracking, plus health classification that separates platform-side template failures from recipient-side delivery blocks (`undeliverable`, country restriction) |

---

## 2. Folder Structure

```
Workers-United/
├── .agent/workflows/          # AI agent workflow docs
│   ├── add-profile-field.md   # Steps to add a new profile field
│   └── project-architecture.md  # ← this file
├── public/                    # Static assets (logo-icon.png, logo-wordmark.png, logo-full.jpg, etc.)
├── scripts/                   # Utility scripts (screenshots, SQL setup, cloud-doctor.ps1 connectivity checks)
├── supabase/                  # SQL migrations & schema files
│   ├── FULL_SETUP.sql         # Comprehensive DB setup
│   ├── schema.sql             # Core tables
│   ├── queue-schema.sql       # Queue & matching tables
│   ├── migrations/            # Incremental migrations (including live `20260308193000_worker_physical_tables.sql` stage 1, live `20260308210000_worker_fk_transition.sql` stage 2, live `20260308223000_drop_legacy_candidate_fk_columns.sql` stage 3, and pending `20260318194000_employer_profile_uniqueness.sql` for employer dedupe + `profile_id` uniqueness)
│   └── ...                    # Other SQL patches
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Root layout (Montserrat, GodMode, CookieConsent)
│   │   ├── page.tsx           # Homepage (landing page)
│   │   ├── globals.css        # Global styles
│   │   ├── login/             # Login page + hash-session finalizer for email confirm/magic-link/recovery flows
│   │   ├── signup/            # Signup page
│   │   ├── profile/
│   │   │   ├── page.tsx       # Auto-redirect (/profile → worker, employer, or agency)
│   │   │   ├── worker/        # Worker workspace in shared AppShell with simplified `Overview / Documents / Queue / Support` language; overview no longer duplicates Documents/Queue/Support cards in the main canvas, main content is a single primary column, worker overview/queue now use `worker`/`workerRecord` as canonical local naming, queue unlock UI and sandbox preview both show the same pre-checkout bank/cardholder guidance, and admin can inspect real worker data via `?inspect=<profile_id>` in read-only preview
│   │   │   ├── employer/      # Canonical employer workspace in shared AppShell; `jobs*` routes redirect back into employer tabs, company/job content now lives in a single primary column without duplicate helper panels, and admin can inspect real employer workspaces via `?inspect=<profile_id>`
│   │   │   ├── agency/        # Agency dashboard + agency-owned worker detail/editor with near-full worker-profile parity; landing page is now a clean `Workers` table with header `Add worker` action, desktop modal intake, direct `Upload docs` entry from the Documents column, a dedicated desktop documents-only modal, and dedicated mobile full-page routes at `/profile/agency/workers/new` and `/profile/agency/workers/[id]/documents`, plus always-unlocked agency support at `/profile/agency/inbox`. Agency draft workers can upload/verify docs before claim through a hidden auth-backed document owner id stored in `worker_onboarding.application_data`, and still share the same `100% + admin approval -> payment unlock` rule as self-managed workers. Generic admin preview uses the same real layout in inspect-only mode, but agency worker detail now exposes an admin-only approval card backed by `/api/admin/agency-workers/[workerId]/approval`
│   │   │   └── settings/      # GDPR: delete account, export data
│   │   ├── admin/
│   │   │   ├── page.tsx       # Business admin dashboard (stats, action cards, queue watch, inbox, recent lists, direct `Preview Worker/Employer/Agency` entry points, and inspect links into real workspaces); preview cards are generic read-only entries, not derived from the admin's own legacy role rows
│   │   │   ├── layout.tsx     # Admin layout (AppShell)
│   │   │   ├── agencies/      # Agency registry with shared admin hero/metrics layout + direct agency workspace inspect links
│   │   │   ├── analytics/     # Funnel dashboard plus payment-quality breakdown (paid vs active vs expired vs bank decline vs Stripe block) sourced from the same latest-attempt classifier as internal ops, with worker-country and billing-country filters for recent payment issues
│   │   │   ├── exceptions/    # Legacy route that now renders the internal ops cockpit copy; business admin no longer links here directly
│   │   │   ├── email-health/  # Legacy route that now renders the internal email-hygiene copy; business admin no longer links here directly
│   │   │   ├── inbox/         # Admin support inbox (support-thread list + reply workspace)
│   │   │   ├── workers/       # Worker registry + [id] case detail; table separates inspect-workspace from admin case actions, filters out hidden agency draft document-owner auth profiles, renders real agency draft worker rows with agency source labels, worker case detail resolves by canonical `worker_onboarding.id` as well as legacy profile/auth ids so agency drafts use the right document-owner id plus agency workspace inspect links instead of leaking through fake `/profile/worker` previews, the document modal now exposes redirect-driven success/error banners plus direct preview links for the exact approval/re-upload email payload, and the approval card now exposes the exact `Job Finder unlocked` email preview
│   │   │   ├── employers/     # Employer registry with shared admin hero/metrics layout; hides internal/admin-owned employer rows and collapses duplicate employer records per `profile_id` via the shared employer integrity helper
│   │   │   ├── queue/         # Queue operations screen with shared admin hero, 90-day watch, and inspect-vs-case actions
│   │   │   ├── jobs/          # Smart Match Hub with shared admin hero/guidance wrapper around matching client
│   │   │   ├── announcements/ # Bulk email sender
│   │   │   ├── refunds/       # Refund management
│   │   │   └── settings/      # Platform settings
│   │   ├── internal/          # Owner-only technical hub kept outside the business admin flow
│   │   │   ├── layout.tsx     # Owner-only gate (GodMode email only; non-owner redirects back to /admin)
│   │   │   ├── page.tsx       # Internal tools landing page
│   │   │   ├── ops/           # Internal ops monitor entry (wraps the shared exception cockpit)
│   │   │   ├── email-health/  # Internal bounced/invalid email hygiene screen
│   │   │   └── email-preview/ # Internal email template sandbox; reuses the shared email-preview workspace while keeping owner-only shortcuts and query-driven payload previews separate from the business admin shell
│   │   ├── api/               # API routes grouped by domain (admin, auth, agency, payments, messaging, AI, cron)
│   │   │   ├── account/       # delete, export (GDPR)
│   │   │   ├── admin/         # delete-user, employer-status, funnel-metrics (now including payment-quality breakdown plus worker/billing-country issue signals), admin inbox support list, agency-worker approval API, and same-origin document preview streaming with legacy image auto-rotation self-heal; manual-match/re-verify are now fully workerId-first
│   │   │   ├── auth/          # hash-session finalize endpoint used by `/login` after Supabase email/magic-link/recovery redirects
│   │   │   ├── agency/        # agency claim + agency-owned worker APIs (detail GET/PATCH + documents GET/upload)
│   │   │   ├── conversations/ # in-platform messaging APIs (support thread bootstrap + message send/read)
│   │   │   ├── cron/          # 9 cron jobs (see below); `brain-monitor` is now the deterministic ops-first daily sweep
│   │   │   ├── documents/     # verify, verify-passport, request-review (fully workerId-first)
│   │   │   ├── contracts/     # prepare, generate (DOCX documents)
│   │   │   ├── stripe/        # create-checkout, webhook, confirm-session fallback; checkout now prebuilds Stripe Customer identity context from canonical worker data, webhook + confirm-session share payment/activation/email finalization helpers, and payment telemetry persists decline/risk plus billing/card-country hints
│   │   │   ├── email-queue/   # Email queue processor
│   │   │   ├── godmode/       # Dev testing endpoint
│   │   │   ├── health/        # Health check (parallelized service probes + WhatsApp delivery audit)
│   │   │   ├── offers/        # Job offers
│   │   │   ├── profile/       # Profile API + authenticated auth-contact sync route (`/api/profile/auth-contact`)
│   │   │   ├── queue/         # auto-match
│   │   │   ├── signatures/    # Signature storage
│   │   │   ├── whatsapp/      # WhatsApp webhook (Meta → GPT-5 mini router + GPT-5.4 mini response flow); delivery-status persistence, identity resolution, OpenAI Responses transport, and history-aware language/fallback handling are now delegated to shared helpers
│   │   │   └── brain/         # AI brain (collect data, self-improve cron, daily exception monitor)
│   │   ├── auth/              # Auth callback + role selection
│   │   │   ├── callback/     # OAuth code callback + hash-link rescue redirect + agency draft claim linking
│   │   │   └── select-role/  # Role picker for Google OAuth first-time users
│   │   ├── privacy-policy/    # GDPR privacy policy page
│   │   └── terms/             # Terms & conditions page
│   ├── proxy.ts                # ← CSRF + auth guard (profile, admin, API routes)
│   ├── components/
│   │   ├── AppShell.tsx        # Layout wrapper (sidebar + navbar + content); worker/employer/agency/admin now share it, with simplified shared nav labels (`Overview`, `Queue`, `Support`, `New Job Request`), agency `Support` nav linked to `/profile/agency/inbox`, inspect-query preservation across admin previews, safe routing back to /admin, business-only admin navigation (no debug/incident links in the sidebar), a wider neutral dashboard canvas (`max-w-[1220px]`), and a stable desktop content frame so collapsing the sidebar no longer shifts the whole page left
│   │   ├── UnifiedNavbar.tsx   # Top navigation bar; non-public logo now routes to role dashboard and shows admin-preview badge when relevant
│   │   ├── forms/AdaptiveSelect.tsx # Shared adaptive select: native `<select>` on mobile, modern custom popover/listbox on desktop, used across worker/employer/agency/admin forms and desktop calendar month/year controls
│   │   ├── forms/PreferenceSheetField.tsx # Shared native-select preference helpers for worker/agency preference fields; keeps legacy `Any` storage compatibility while surfacing `All industries` / `All destinations` in the UI and allows shorter display labels (e.g. `Bosnia & Herzegovina`) without changing stored values
│   │   ├── forms/InternationalPhoneField.tsx # Shared modern phone input shell (flag + calling code + searchable picker) used across worker/employer/agency forms
│   │   ├── forms/NativeDateField.tsx # Shared compact date field: mobile keeps the native iPhone/Android picker, desktop opens a custom calendar popover and now delegates month/year dropdown styling to `AdaptiveSelect`
│   │   ├── admin/AdminSectionHero.tsx # Shared admin hero + metrics surface for registry pages
│   │   ├── admin/EmailPreviewWorkspace.tsx # Shared client workspace that lists every system email template, adds category/search filtering, and renders the live iframe preview for both admin and internal email-preview routes
│   │   ├── admin/DocumentPreview.tsx # Admin contract-payload preview card aligned with the worker case ops UI
│   │   ├── admin/ActionSubmitButton.tsx # Shared pending-aware submit button for slower admin document actions
│   │   ├── ContactForm.tsx     # Contact form + AI auto-reply
│   │   ├── CookieConsent.tsx   # GDPR cookie banner
│   │   ├── AgencySetupRequired.tsx # Graceful setup-required card when agency migration is missing
│   │   ├── messaging/         # Shared conversation thread UI, including the shared worker/agency support inbox client
│   │   ├── DocumentWizard.tsx  # Document upload flow; verify requests now send only canonical `workerId`, the diploma card explicitly asks for a final school/university/formal-vocational diploma, and the biometric-photo card now asks for a recent passport-style photo with a plain light background while skipping extra post-crop compression so sharpness is preserved
│   │   ├── DocumentGenerator.tsx # Admin: generate 4 DOCX visa docs
│   │   ├── SignaturePad.tsx    # Digital signature component
│   │   ├── DeleteUserButton.tsx # Admin: delete user completely
│   │   ├── EmployerStatusButton.tsx # Admin: change employer status
│   │   ├── GodModePanel.tsx    # Dev testing panel + owner shortcut into `/internal`
│   │   └── GodModeWrapper.tsx  # GodMode conditional loader
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts      # Browser Supabase client
│   │   │   ├── server.ts      # Server Supabase client (SSR)
│   │   │   ├── admin.ts       # Service-role Supabase client (bypasses RLS)
│   │   │   └── middleware.ts  # Auth middleware / proxy
│   │   ├── mailer.ts          # sendEmail() via Nodemailer
│   │   ├── email-templates.ts # HTML email templates + checkout recovery notification mapping; `admin_update` now honors custom CTA/link payloads so approval-unlock mail and previews can reuse the premium system template without bespoke HTML
│   │   ├── admin-email-preview.ts # Shared admin email-preview type guards + deep-link payload serialization helpers
│   │   ├── worker-approval-notifications.ts # Shared `Job Finder Is Now Unlocked` admin-update payload used by worker/agency approval flows and preview shortcuts
│   │   ├── document-ai.ts     # GPT-primary document AI helpers with Gemini fallback; passport verification is strict about the actual biodata page, passport bounds detection now trims open-passport spreads down to the single biodata/MRZ page, diploma verification has a formal-education guard, biometric-photo verification uses embassy-grade quality guardrails, and shared quarter-turn orientation helpers/ocr patches power auto-rotation for verify + admin preview flows
│   │   ├── document-image-processing.ts # Shared document image rotate/crop + OCR metadata helpers used by verify uploads and admin preview/manual-crop flows
│   │   ├── document-review.ts # Shared admin/worker document-review copy helpers derived from canonical `ocr_json` + `reject_reason`, including strict diploma summaries plus biometric-photo summaries/re-upload guidance that explain whether the issue is quality, framing, lighting, background, or wrong document type
│   │   ├── stripe.ts          # Stripe client initialization
│   │   ├── stripe-checkout.ts # Shared Stripe Checkout customer identity + metadata helpers (customer prefill/reuse, webhook correlation payload)
│   │   ├── stripe-payment-finalization.ts # Shared completed-payment upsert, failure/expiry metadata persistence, entry-fee queue activation, payment-success email, and activity-payload helpers used by webhook and confirm-session
│   │   ├── stripe-webhook-handlers.ts # Shared per-event Stripe webhook handlers; route remains a thin signature verifier + dispatcher
│   │   ├── payment-quality.ts # Shared payment-attempt quality classifier plus market-signal reader (worker country, billing country, card country) used by internal ops and analytics
│   │   ├── payment-eligibility.ts # Entry-fee eligibility rules (single source of truth)
│   │   ├── messaging.ts       # Support conversation helpers (access gating, conversation creation, message persistence, summaries)
│   │   ├── brain-memory.ts    # Brain memory dedup + normalization helpers
│   │   ├── auth-contact-sync.ts # Shared Auth phone/full-name sync planner + service-role updater for canonical profile data
│   │   ├── auth-contact-sync-client.ts # Small browser helper for calling `/api/profile/auth-contact` after self-service saves
│   │   ├── admin-exceptions.ts # Shared technical exception snapshot helper (checkout drift, payment-quality classification, email hygiene, manual review, pending admin approval, queue/payment mismatch, employer demand)
│   │   ├── ops-monitor.ts     # Deterministic ops-first daily monitor builder + compact alert email renderer (route health, WhatsApp, docs, email, payments, auth)
│   │   ├── reporting.ts       # Reporting filters + email hygiene helpers (exclude Codex/test/internal-orphan payments, `.dev`/`.internal`/draft-worker contacts, typo correction suggestions, undeliverable error detection)
│   │   ├── notifications.ts   # Email notification helpers
│   │   ├── admin.ts           # Admin utility functions
│   │   ├── employers.ts       # Canonical employer integrity helpers: pick/ensure one employer per `profile_id`, block admin/internal sandbox employer provisioning, and hide test/admin employer rows from business admin views/search
│   │   ├── auth-redirect.ts   # Shared post-auth provisioning + role-aware redirect resolver for callback/hash login finalize flows; queues automated welcome only for real deliverable contacts
│   │   ├── constants.ts       # Shared constants
│   │   ├── workers.ts         # Canonical worker lookup + normalization helpers (duplicate-safe worker record selection over legacy physical worker table via `worker_onboarding`, phone normalization, storage filename sanitization)
│   │   ├── worker-notification-eligibility.ts # Shared guard for worker direct email/WhatsApp automations; blocks hidden draft owners, internal/test addresses, and agency drafts without real worker email+phone
│   │   ├── godmode.ts         # GodMode utilities
│   │   ├── docx-generator.ts  # DOCX generation (docxtemplater + nationality mapping)
│   │   ├── whatsapp.ts        # WhatsApp Cloud API (template sending, logging, failed-send error capture)
│   │   ├── whatsapp-admin-commands.ts # Shared owner/admin WhatsApp memory-edit commands (`ispravi`, `zapamti`, `obrisi`, `memorija`) extracted from the webhook route
│   │   ├── whatsapp-brain.ts  # Canonical WhatsApp facts/rules, safe-learning filter, explicit onboarding trigger, conversation-aware language resolver, and explicit language-switch detection
│   │   ├── whatsapp-conversation-helpers.ts # Shared WhatsApp transcript formatting, history/brain-memory loading, and worker auto-handoff summary creation extracted from the webhook route
│   │   ├── whatsapp-employer-flow.ts # Shared employer lead detection + employer reply prompt/fallback helpers extracted from the webhook route
│   │   ├── whatsapp-fallback.ts # Shared config-driven multilingual fallback copy extracted from the webhook route, now honoring explicit language-switch requests and recent conversation language
│   │   ├── whatsapp-identity.ts # Shared multi-layer WhatsApp worker/profile phone lookup (worker phone match, auth-phone fallback, profile load, phone backfill) extracted from the webhook route
│   │   ├── openai-response-text.ts # Shared OpenAI Responses API caller + `output_text/output[]` extraction helper used by the WhatsApp webhook
│   │   ├── whatsapp-reply-guardrails.ts # Shared deterministic WhatsApp payment/escalation/inventory guardrail copy + media fallback replies extracted from the webhook route
│   │   ├── whatsapp-status-events.ts # Shared Meta delivery-status persistence helpers extracted from the webhook route
│   │   ├── whatsapp-worker-ai.ts # Shared worker snapshot + intent-router prompt + worker response prompt helpers extracted from the webhook route
│   │   ├── whatsapp-health.ts # WhatsApp ops-health classification helpers (platform-side vs recipient-side failures)
│   │   ├── profile-retention.ts # Shared inactivity-retention helper; derives the last meaningful profile activity across auth/profile/role/docs/signatures/admin case emails/user activity so reminders, cleanup, and admin countdowns stay aligned
│   │   ├── sanitize.ts        # Input sanitization
│   │   ├── user-management.ts # Shared user deletion logic; cascade cleanup deletes worker-domain rows (`worker_documents`, `workers`, matches/offers/contracts), employer-domain rows (`job_requests`, employer-owned `offers`/`matches`, related support conversations), removes document files by real `worker_documents.storage_path` before falling back to legacy user folders, also clears `payments.profile_id` + `user_activity`, and keeps canonical app-layer naming as `workerRecord`
│   │   ├── database.types.ts  # Auto-generated Supabase types (npm run db:types)
│   │   └── imageUtils.ts      # Image processing helpers; biometric-photo normalization now preserves more original detail and avoids unnecessary downscaling/upscaling
│   └── types/                 # TypeScript types (currently empty)
├── vercel.json                # Vercel config: security headers + 9 cron jobs
├── next.config.ts             # Next.js config
├── tsconfig.json              # TypeScript config (`scripts/` excluded from app typecheck; Next may auto-add `.next/dev/types`)
├── package.json               # Dependencies & scripts (`npm run typecheck` = canonical TS gate)
├── AGENTS.md                  # 🔑 THE source of truth (business + tech, env vars, rules, TODO)
├── CHANGELOG.md               # 📋 Full history of completed changes
└── IMPROVEMENTS.md            # UI/UX improvement ideas
```

---

## 3. Cron Jobs (Vercel)

Configured in `vercel.json`:

| Path | Schedule | Purpose |
|---|---|---|
| `/api/cron/check-expiry` | Every hour | Check for expired sessions/tokens |
| `/api/cron/profile-reminders` | Daily 9 AM UTC | Remind users with incomplete profiles, warn at `14 / 7 / 3` inactivity days-left, and auto-delete only after `90` days of real inactivity; worker sends skip hidden/internal/test contacts, agency draft workers without real direct contact data, and any paid/post-payment worker case |
| `/api/cron/check-expiring-docs` | Daily 10 AM UTC | Alert when passport expires within 6 months |
| `/api/cron/match-jobs` | Every 6 hours | Auto-match workers to employer job requests |
| `/api/cron/brain-monitor` | Daily 8 AM UTC | Deterministic ops-first daily sweep; stores a compact `brain_reports` snapshot every run and emails only when critical/high operational signals are present |
| `/api/brain/improve` | Daily 3 AM UTC | **AI self-improvement** — scans DB + conversations, but now stores only low-risk WhatsApp learnings (`common_question`, `error_fix`, `copy_rule`) after shared safety filtering |
| `/api/cron/whatsapp-nudge` | Daily 11 AM UTC | WhatsApp nudges for users who need a profile/doc action; now reuses the shared worker direct-notification eligibility guard so agency/test/draft contacts are skipped the same way as email/reminder automation |
| `/api/cron/checkout-recovery` | Every hour at :15 | Recover opened but unpaid `$9` Job Finder checkouts with `1h / 24h / 72h` follow-up and mark stale pending rows as `abandoned` |
| `/api/cron/system-smoke` | Every hour at :30 | Route + service smoke monitor (`/`, auth pages, `/api/health`) with critical alert cooldown; optional degraded services now surface as warnings instead of silent healthy |

---

## 4. Data Flow

```
User (Browser)
  │
  ├─► Next.js App Router (SSR + Client Components)
  │     ├─► Supabase Auth (login, signup, password reset)
  │     ├─► Supabase Database (profiles, workers/worker_onboarding, employers, worker_documents, queue)
  │     │     └─► Messaging tables (`conversations`, `conversation_participants`, `conversation_messages`, `conversation_flags`)
  │     ├─► Supabase Storage (passport, diploma, biometric_photo uploads)
  │     ├─► Stripe (entry fee $9, placement fee $190)
  │     │     └─► Webhook → /api/stripe/webhook (post-payment actions)
  │     └─► Document AI (OpenAI GPT primary, Gemini fallback for verification)
  │
  ├─► Email (Nodemailer + SMTP)
  │     ├─► Contact form auto-reply
  │     ├─► Status change notifications
  │     ├─► Profile reminders (cron)
  │     └─► Admin bulk announcements
  │
  └─► Vercel Cron → /api/cron/* (scheduled background jobs; Brain daily runs always save a snapshot, but email only on exception)
```

### Authentication Flow
1. User signs up (email/password OR Google OAuth) → Supabase creates auth user and the live `public.handle_new_user()` trigger provisions `profiles` plus canonical `workers`/`employers`
2. For Google OAuth from signup page: `user_type` is passed via URL param and set in metadata; the live auth metadata-sync trigger then aligns `profiles.user_type` plus the canonical worker/employer row after callback
3. For Google OAuth from login page (first time): user is redirected to `/auth/select-role` to choose worker/employer/agency
4. Email confirmation, password recovery, and Supabase magic-link flows can land on `/login` with `#access_token=...`; `src/app/login/LoginClient.tsx` now restores that session client-side, and `POST /api/auth/finalize` reuses the shared post-auth resolver to return the correct workspace URL
5. Employer provisioning now goes through `src/lib/employers.ts#ensureEmployerRecord()`, so role selection, auth redirect self-heal, and first employer profile save all reuse the same duplicate-safe logic and refuse to create live employer rows for admin/internal sandbox accounts
5. Self-service worker/employer profile saves now call `POST /api/profile/auth-contact`, which mirrors canonical phone/full-name data back into Auth `raw_user_meta_data` and the visible Auth `phone` stub when a valid international phone is present
6. `/auth/callback` remains the code-exchange path for OAuth, but when there is no `code` it now forwards the browser back to `/login?mode=confirm|recovery` so the hash-session flow can finish instead of dumping users onto a dead auth error state
7. Agency-submitted worker drafts can be claimed via `/signup?type=worker&claim=<worker-record-id>`; callback/API links the draft to the real worker auth/profile only when the worker signs up with the same invited email, and the claim token resolves against the canonical worker record id
8. Claimed or draft agency workers can be managed from `/profile/agency/workers/[id]`, where the agency can fill almost the full worker profile (`identity/contact/citizenship/family/preferences/passport`), while keeping `email` and `phone` optional contact channels; document upload/replacement/manual review now also has its own shared surface, opened as a desktop-only documents modal from `/profile/agency` or as the dedicated mobile route `/profile/agency/workers/[id]/documents`, while the full editor still embeds the same shared panel plus admin approval controls and the `$9` Job Finder payment for agency-managed workers
9. Agency draft worker documents no longer use `worker_onboarding.id` as `worker_documents.user_id`. `src/lib/agency-draft-documents.ts` creates or reuses a hidden auth-backed profile id stored in `worker_onboarding.application_data.draft_document_owner_profile_id`, and all agency draft document reads/writes/verifications/manual-review requests go through that owner id until the draft is claimed
10. During draft claim, `claimAgencyWorkerDraft()` relinks `worker_documents.user_id` from the hidden draft owner id to the real claimed `profile_id`, copies each storage object into the claimed worker folder, updates `storage_path`, removes the old hidden-owner object, clears the application-data pointer, and deletes the temporary hidden auth/profile owner
11. Generic admin access to `/profile/agency` is now a true structure preview: it never provisions an agency row or downgrades the admin role, and it opens the same add-worker surfaces (desktop modal, mobile full-page create route) plus table layout without persisting fake preview drafts between refreshes
12. `/admin/workers` must never list the hidden draft document-owner auth accounts created by `src/lib/agency-draft-documents.ts`; those internal profiles exist only so draft uploads have a valid `worker_documents.user_id`. The registry now filters them out and rebuilds agency draft rows from the real `worker_onboarding` data, while `/admin/workers/[id]` resolves those draft case ids back to the canonical draft worker row plus its hidden `documentOwnerId`
13. Admin access to `/profile/worker` and `/profile/employer` remains read-only preview only, while `/profile/agency?inspect=<profile_id>` opens the real target agency workspace with admin authority attached to that agency instead of overloading the admin's own role records
14. Employer workspace is now canonical at `/profile/employer`; legacy `/profile/employer/jobs` and `/profile/employer/jobs/new` immediately redirect into `?tab=jobs` and `?tab=post-job`
15. On first login, `src/lib/auth-redirect.ts` now also self-heals Auth phone metadata from canonical worker/employer/agency contact rows so existing users gradually repopulate the Supabase Auth `Phone` column without a manual migration
16. On first login → user creates profile in the worker/employer domain; app-layer runtime talks to `worker_onboarding` / `worker_documents`, and the live public schema no longer exposes the removed `candidates` / `candidate_documents` aliases
17. Document verification, manual review requests, and manual match admin flows now use canonical `workerId` only; the old legacy request shape is no longer active in app-layer runtime
18. `profiles` table links auth user to their role
19. Proxy (`src/proxy.ts`) checks auth state on protected routes
20. Shared deletion now trusts `worker_documents.storage_path` as the primary cleanup source, so account deletion and `profile-reminders` auto-delete do not miss documents even if an older row was relinked before the storage-path migration fix

### Payment Flow
1. Worker or agency-managed worker completes the full profile + documents to 100% → case moves to `PENDING_APPROVAL`
2. Admin approves the case (`APPROVED`) → only then does the `$9` Job Finder payment unlock
3. Worker or agency clicks "Pay" → Stripe Checkout Session created (`/api/stripe/create-checkout`), while the pending payment row stores `deadline_at` and `metadata.checkout_started_at` for abandoned-checkout recovery + Brain metrics
3. Agency-on-behalf payments target the claimed worker `profile_id`, while metadata preserves the paying agency profile and worker id
4. Stripe redirects back → Webhook confirms payment (`/api/stripe/webhook`)
5. Success redirect includes `session_id`; client can call `/api/stripe/confirm-session` as fallback if webhook is delayed
6. Worker enters queue (`IN_QUEUE` status or preserved advanced status)
7. Successful `$9` unlocks `/profile/worker/inbox`, where the worker can write only to Workers United support
8. Cron job (`match-jobs`) attempts to match with employer requests

9. Entry-fee checkout auto-heal logs `checkout_worker_auto_created` when it has to provision a missing canonical `worker_onboarding` row for an otherwise valid worker profile before opening Stripe

### Messaging Flow (Support v1)
1. Supabase migration `20260306234500_messaging_foundation.sql` creates `conversations`, `conversation_participants`, `conversation_messages`, and `conversation_flags`
2. Worker opens `/profile/worker/inbox` after a successful `$9` payment
3. Agency opens `/profile/agency/inbox` at any time; agency support is always unlocked and does not depend on worker payment state
4. `/api/conversations/support` checks the payment gate only for workers and auto-creates a single support thread per worker/employer/agency account on first access
5. Worker/agency and admin exchange messages through `/api/conversations/[conversationId]/messages`
6. Admin reads and replies from `/admin/inbox`; the admin dashboard and sidebar link there directly
7. Contact information stays hidden; worker/employer direct chat is still future work and must unlock only after `accepted offer + placement fee paid`

---

## 5. Key Files & Their Roles

### Layout & Navigation
| File | Role |
|---|---|
| `src/app/layout.tsx` | Root layout — loads Montserrat font, GodModeWrapper, CookieConsent |
| `src/app/login/LoginClient.tsx` | Login/auth recovery screen — handles classic login, request-reset, password update, and Supabase hash-session finalize for confirm/magic-link/recovery links |
| `src/components/AppShell.tsx` | Authenticated page wrapper — sidebar + navbar with role-specific navigation for worker/employer/agency/admin; admin preview mode shows a clear preview banner, preserves `?inspect=` across workspace nav, routes Dashboard back to `/admin`, exposes agency `Support` directly in the shared shell, keeps only `Back to Admin` plus the current role navigation inside preview workspaces, keeps business admin navigation free of debug/incident entries, and uses a wider neutral dashboard canvas |
| `src/components/DocumentWizard.tsx` | Worker document upload flow; upload keys now pass through `sanitizeStorageFileName()` so camera-style filenames like `IMG_...~2.jpg` cannot break Supabase Storage with `Invalid key`, the UI resolves the canonical `worker-docs` bucket through a shared worker-first helper, the diploma card copy explicitly asks for a final school/university/formal-vocational diploma, and biometric-photo uploads keep their sharper processed output instead of being compressed twice |
| `src/lib/worker-documents.ts` | Shared worker-first wrapper for the canonical `worker-docs` bucket, public URL builder, and canonical required-doc progress helper (`uploaded / verified / pending / rejected`) used to keep agency/admin counters aligned |
| `src/lib/agency-draft-documents.ts` | Shared draft-document owner helper for agency-managed workers; ensures every draft document points to a real auth/profile id, stores that owner id in `worker_onboarding.application_data`, and relinks/cleans it up during claim |
| `src/components/UnifiedNavbar.tsx` | Top navigation bar (logo, links, user menu); dashboard logo routes by role and surfaces `Admin Preview` when admin is viewing worker/employer/agency workspaces |

### Worker Flow
| File | Role |
|---|---|
| `src/app/profile/worker/page.tsx` | Worker profile landing; supports read-only admin inspect of a real worker via `?inspect=<profile_id>` and loads worker data through the canonical worker helper instead of assuming a unique physical worker row |
| `src/app/profile/worker/DashboardClient.tsx` | Clean worker overview surface with payment CTA/state and support unlock explanation; sidebar remains the navigation source for Documents/Queue/Support/Edit |
| `src/app/profile/worker/inbox/page.tsx` | Worker support inbox route; now renders inside the shared `AppShell` instead of a standalone page |
| `src/app/profile/worker/inbox/WorkerInboxClient.tsx` | Thin worker wrapper around the shared support inbox client; keeps worker-specific payment lock behavior |
| `src/app/profile/worker/edit/` | Single-page profile edit form; app-layer state now uses `workerRecord` naming instead of local `candidate` aliases, while save path still reuses canonical worker lookup so an existing worker no longer inserts duplicate worker rows when drift already exists |
| `src/app/profile/worker/documents/` | Document upload (passport, diploma, photo); the client flow now uses `workerProfileId` as the canonical prop for the worker document owner and verification/request-review payloads are fully workerId-first; also supports read-only admin inspect of the target worker documents |
| `src/app/profile/worker/queue/` | Queue status page; also supports read-only admin inspect of the target worker payment/queue state |
| `src/app/profile/worker/offers/[id]/` | Individual job offer details |

### Auth & Redirect Flow
| File | Role |
|---|---|
| `src/app/auth/callback/route.ts` | Server callback for OAuth/code-exchange auth; now also rescues non-code auth links by forwarding them to `/login?mode=confirm|recovery` instead of failing cold |
| `src/app/api/auth/finalize/route.ts` | Finalize endpoint used after `LoginClient` restores a hash session; validates the user and returns the final role-aware workspace href |
| `src/lib/auth-redirect.ts` | Shared post-auth provisioning/redirect engine used by both `/auth/callback` and `/api/auth/finalize` so admin/employer/agency/worker routing stays consistent, while automated welcome sends are skipped for hidden/internal/test contacts |

### Employer Flow
| File | Role |
|---|---|
| `src/app/profile/employer/page.tsx` | Canonical employer workspace with tabs for company info, post-job form, and active jobs inside shared `AppShell`; sidebar remains the single navigation source for `New Job Request`, and the jobs empty state no longer duplicates that CTA in the main canvas; supports read-only admin inspect via `?inspect=<profile_id>` |
| `src/app/profile/employer/jobs/` | Legacy redirect to `/profile/employer?tab=jobs` |
| `src/app/profile/employer/jobs/new/` | Legacy redirect to `/profile/employer?tab=post-job` |

### Agency Flow
| File | Role |
|---|---|
| `src/app/profile/agency/page.tsx` | Agency workspace entry; loads real agency workers with the full `worker_onboarding` record before computing completion, supports generic admin structure preview without fake persisted drafts, and allows real agency inspect via `?inspect=<profile_id>` without role drift |
| `src/app/profile/agency/AgencyDashboardClient.tsx` | Single-board agency dashboard: clean workers table, header search + the only `Add worker` CTA, desktop modal add/edit flow, mobile full-page `Add worker` routing, generic admin preview that uses the same real layout without local fake-data storage, and explicit document progress text under the docs CTA so operators can see uploaded-vs-verified state from the board |
| `src/app/profile/agency/inbox/page.tsx` | Agency support inbox route; always unlocked for agencies, admin inspect stays read-only, and the page now reuses the shared `AppShell` workspace navigation |
| `src/app/profile/agency/workers/new/page.tsx` | Mobile-first full-page agency worker create route; reuses the shared intake form, preserves admin inspect auth guards, and routes back to the agency dashboard after close/save |
| `src/components/messaging/SupportInboxClient.tsx` | Shared worker/agency support inbox UI with audience-specific copy, locked states, admin preview mode, and the same neutral workspace styling used by dashboard surfaces |

### Admin / Data Surfaces
| File | Role |
|---|---|
| `src/app/admin/exceptions/page.tsx` | Legacy internal-ops route; still renders the shared technical exception cockpit, but the business admin shell no longer links to it and owners should enter through `/internal/ops` |
| `src/app/admin/email-health/page.tsx` | Legacy internal email-hygiene route; still renders the shared bounced/invalid email screen, but owners should enter through `/internal/email-health` |
| `src/app/admin/email-health/EmailHealthClient.tsx` | Client-side email-health UI with safe-delete actions via the existing admin delete-user API |
| `src/app/api/admin/search/route.ts` | Global admin search; returns `worker` as the canonical app-layer result, dedupes duplicate worker rows per `profile_id`, and keeps employer hits separate from worker hits |
| `src/app/admin/workers/page.tsx` | Worker registry for admin ops; dedupes duplicate worker rows per `profile_id` via the canonical worker helper before computing stats or rendering the table, and now derives required-doc uploaded/verified counts from the shared worker-doc progress helper so draft/claimed rows use the same semantics |
| `src/app/admin/workers/[id]/page.tsx` | Admin worker case view; now loads the canonical worker record, renders same-origin document preview URLs, reads canonical document review fields (`ocr_json`, `reject_reason`, `verified_at`) instead of removed legacy columns, and passes image docs into the manual crop-capable review modal |
| `src/app/api/check-profile-completion/route.ts` | Worker readiness re-check after saves/uploads; returns base completion snapshot and delegates strict review-status + `profile_complete` notification ownership to `src/lib/worker-review.ts` instead of writing `worker_onboarding.status` directly |
| `src/app/api/admin/documents/[documentId]/preview/route.ts` | Same-origin admin document preview stream; downloads from `worker-docs` with service-role access, returns inline PDF/image responses so browser viewers work inside the admin modal, now runs one-shot AI rotation + auto-crop self-heal for legacy image docs, and its `POST` path both saves manual admin crop selections after first preserving an `_admin-originals/` backup and restores that original backup on demand |
| `src/app/api/account/export/route.ts` | Self-service data export; returns canonical `worker` data from `worker_onboarding`, and includes agency-owned worker lists when the account has an agency profile |
| `src/app/profile/agency/AgencyWorkerCreateModal.tsx` | Shared agency worker intake surface; supports desktop modal mode plus standalone full-page mode, save-draft, close-confirm, inspect-only admin preview, and real agency creation through `/api/agency/workers` |
| `src/app/profile/agency/workers/[id]/AgencyWorkerClient.tsx` | Full worker editor for agency-owned workers, including documents, review requests, and Job Finder payment for claimed workers |
| `src/app/profile/agency/AgencyWorkerDocumentsPanel.tsx` | Shared documents-only surface for agency upload/replace/manual-review flow; reused by dashboard modal, dedicated mobile documents page, and embedded worker detail |
| `src/app/profile/agency/AgencyWorkerDocumentsModal.tsx` | Desktop-only documents popup opened from the agency dashboard `Upload docs` action |

### Internal / Technical Tools
| File | Role |
|---|---|
| `src/app/internal/layout.tsx` | Owner-only gate for internal tools; requires auth and `isGodModeUser(email)`, otherwise redirects to `/admin` |
| `src/app/internal/page.tsx` | Hidden internal tools landing page; clearly separates technical monitors/template sandbox from firm-facing admin operations and now exposes direct shortcut cards for the most common email preview scenarios |
| `src/app/internal/ops/page.tsx` | Canonical entry point for the ops monitor / exception cockpit |
| `src/app/internal/email-health/page.tsx` | Canonical entry point for bounced/invalid email hygiene |
| `src/app/internal/email-preview/page.tsx` | Owner-only wrapper around the shared email preview workspace; keeps internal banner/context while still opening exact query-driven payload previews from admin worker document actions |

### Admin
| File | Role |
|---|---|
| `src/app/admin/page.tsx` | Business admin dashboard with actionable stats, queue watch, recent lists, direct inspect links into real worker/employer/agency workspaces, and a prominent `Open Email Preview` CTA so admin can jump straight into the system-email sandbox without hunting through navigation |
| `src/app/admin/email-preview/page.tsx` | Business-admin email preview page inside the normal AppShell; exposes the full template list, category/search filtering, and live payload preview without requiring the internal tools hub |
| `src/app/admin/agencies/page.tsx` | Agency operations list with owner metadata, worker counts, and direct workspace inspect links |
| `src/app/admin/inbox/page.tsx` | Admin support inbox page |
| `src/app/admin/inbox/AdminInboxClient.tsx` | Client workspace for selecting and replying to support threads |
| `src/app/admin/workers/page.tsx` | Worker list with filter tabs plus inactivity-based cleanup countdowns derived from the shared retention helper instead of raw signup age |
| `src/app/admin/workers/[id]/page.tsx` | Worker case surface with shared admin ops cards for profile snapshot, approvals, payments, contract payload, signature, and document review; image preview modals now include a manual crop tool plus `Restore original` backup recovery for fixing extra passport pages/margins without forcing a re-upload, document actions surface redirect-driven success/error banners plus direct approval/re-upload email preview links, and `Request new document` logs `document_reupload_requested` activity so genuine admin follow-up resets the cleanup timer |
| `src/app/admin/queue/page.tsx` | Queue operations screen; canonical worker dedupe prevents duplicate worker rows from inflating queue counts, refund watch, or urgent countdowns |
| `src/app/admin/jobs/page.tsx` | Smart Match Hub; loads the queue through canonical worker dedupe before handing it to matching UI |
| `src/app/admin/announcements/page.tsx` | Bulk email (Workers / Employers / Everyone) |
| `src/app/admin/settings/page.tsx` | Platform settings |

### Backend (lib)
| File | Role |
|---|---|
| `src/lib/supabase/client.ts` | Browser-side Supabase client |
| `src/lib/supabase/server.ts` | Server-side Supabase client (SSR) |
| `src/lib/supabase/admin.ts` | Service-role clients: legacy `createAdminClient()` + staged `createTypedAdminClient()` for schema-sensitive routes |
| `src/lib/mailer.ts` | `sendEmail()` — Nodemailer wrapper |
| `src/lib/admin-email-preview.ts` | Shared admin email-preview type guards plus payload serialization/parsing for deep-linked live template previews, including offer lifecycle templates like `job_offer`, `offer_reminder`, and `offer_expired` |
| `src/lib/email-templates.ts` | All HTML email templates; includes `checkout_recovery`, `document_review_result`, `offer_expired`, and a CTA-aware `admin_update` template reused by the shared approval-unlock mail payload |
| `src/lib/worker-approval-notifications.ts` | Shared `Job Finder Is Now Unlocked` email payload so self-managed worker approval, agency approval, and preview shortcuts all reuse the exact same copy |
| `src/lib/brain-memory.ts` | Dedupe + normalize helper for `brain_memory` writes |
| `src/lib/whatsapp-brain.ts` | Shared canonical WhatsApp facts/rules, safer worker/employer prompting, deterministic first-contact greeting reply, conversation-aware language resolution for short/colloquial follow-ups, explicit language-switch detection (`write in Serbian/French/Hindi`, `Piši na srpskom`, etc.), explicit `profile complete + admin approval -> payment unlock` guard language, no-fake-escalation rule set, onboarding trigger detection, and low-risk learning filter used by `/api/whatsapp/webhook` + `/api/brain/improve` |
| `src/lib/smoke-evaluator.ts` | Shared health evaluator (`healthy/degraded/critical`) for smoke checks |
| `src/lib/document-ai.ts` | Shared document AI helpers (OpenAI primary, Gemini fallback); passport verifier rejects closed covers / wrong pages, diploma verification has a strict formal-education guard, biometric-photo verification now applies embassy-grade quality checks before accepting a portrait, all emit structured worker guidance, and the file exposes quarter-turn orientation + canonical `ocr_json` patch helpers used by verify/admin preview auto-rotation |
| `src/lib/document-review.ts` | Shared review helper that turns canonical `ocr_json` / `reject_reason` into admin-facing summaries and worker-facing re-upload guidance, including strict diploma-specific copy plus biometric-photo guidance that calls out scan-vs-original issues, blur, lighting, background, and framing problems |
| `src/lib/worker-review.ts` | Shared worker review/readiness helpers; keeps `PENDING_APPROVAL` gated behind truly admin-verified required documents, safely backfills blank passport issue/expiry/issuer fields from the latest passport `ocr_json` before recalculating completion, and syncs worker status after verify/admin doc decisions |
| `src/lib/profile-retention.ts` | Shared inactivity-retention signals + thresholds (`90` day delete window, `14 / 7 / 3` warning cadence, admin-list near-cleanup window) derived from the latest meaningful auth/profile/role/docs/signature/case-email/user-activity timestamp |
| `src/lib/stripe.ts` | Stripe client init |
| `src/lib/stripe-payment-finalization.ts` | Shared Stripe post-payment/failure helpers; centralizes canonical amount mapping, completed checkout payment upsert by `payment_id/session_id`, duplicate-insert recovery, metadata merge/update by payment/session reference (including pending-only checkout expiry updates), entry-fee worker queue activation, deduped `payment_success` email send, and canonical activity payload builders for both direct and agency-managed worker payment events |
| `src/lib/payment-eligibility.ts` | Centralized entry-fee eligibility checks used by Stripe checkout API; `worker` is the canonical state name, with a legacy `EntryFeeCandidateState` alias kept for compatibility |
| `src/lib/messaging.ts` | Messaging helpers for support access gates, support thread creation, participant access checks, message persistence, and admin summaries; worker payment gating now uses canonical `workerRecord` naming instead of legacy `candidate` locals |
| `src/lib/admin-exceptions.ts` | Shared technical exception snapshot helper used by the internal ops screens and the ops-first daily monitor; centralizes invalid-email, checkout drift, manual review, pending admin approval, worker readiness, queue/payment mismatch, open-demand-without-offers signals, and now a 24h WhatsApp quality snapshot (`guarded`, `language fallback`, `deterministic`, `auto handoff`, `media fallback`, `openai failure`) for `/internal/ops` |
| `src/lib/ops-monitor.ts` | Deterministic ops monitor builder + email renderer; turns route health, `opsSnapshot`, WhatsApp confusion/platform failures, document backlog/rejections, email hygiene, payment drift, and auth drift into a compact scored report |
| `src/lib/whatsapp-quality.ts` | Shared WhatsApp quality helper layer; analyzes repeated confusion from live history, ignores failed outbound rows so undelivered bot replies do not count as real assistant turns, drives truthful support auto-handoff thresholds in the webhook, and derives 24h quality metrics plus recent auto-handoff samples from `user_activity` |
| `src/lib/reporting.ts` | Shared reporting + email-hygiene helpers; keeps admin dashboard and analytics revenue clean by excluding Codex/test/internal-orphan payment rows and flags `.dev` / `.internal` / draft-worker contacts as non-deliverable internal traffic |
| `src/lib/worker-notification-eligibility.ts` | Shared guard for worker direct notifications; hidden draft-owner auth users never receive welcome/reminder/profile-complete sends, and agency draft workers only become directly contactable after the agency provides the real worker email plus phone |
| `src/lib/contract-data.ts` | Shared contract-doc payload builder; derives full PDF data from live `matches/worker_onboarding/profiles/employers/job_requests/worker_documents`, exposes `worker` / `workerProfile` as the canonical build result, and persists only supported `contract_data` override/meta fields (`worker_*`, job description, signing/meta data) |
| `src/lib/offer-finalization.ts` | Shared confirmation-fee finalization helper; idempotently transitions `offers.pending -> offers.accepted` and increments job capacity once |
| `src/lib/domain.ts` | Canonical role/domain helper; normalizes legacy `candidate` metadata into the `worker` domain and exposes worker storage constants |
| `src/lib/workers.ts` | Canonical worker helper layer; use `loadCanonicalWorkerRecord()` / `pickCanonicalWorkerRecord()` instead of raw `.single()` / `.maybeSingle()` on `worker_onboarding`/`workers`, plus shared phone normalization and storage filename sanitization |
| `src/lib/agencies.ts` | Agency provisioning + ownership helper; schema guard, claim-link context, claim linking, and agency-owned worker resolution over `worker_onboarding` / physical `workers` |
| `src/lib/stripe-webhook-handlers.ts` | Shared Stripe webhook event handlers; maps each supported event into shared payment persistence/finalization helpers plus activity logging, so `src/app/api/stripe/webhook/route.ts` stays a thin router |
| `src/lib/whatsapp-admin-commands.ts` | Shared deterministic admin/owner WhatsApp command handler; processes `ispravi` / `zapamti` / `obrisi` / `memorija` brain-memory control messages so `src/app/api/whatsapp/webhook/route.ts` only delegates and returns |
| `src/lib/whatsapp-conversation-helpers.ts` | Shared WhatsApp conversation helpers; loads recent `whatsapp_messages` while filtering failed outbound rows from prompt history, filters safe `brain_memory`, formats transcripts for prompts, and creates worker support auto-handoff summaries/flags so `src/app/api/whatsapp/webhook/route.ts` does not hardcode those side-effect helpers inline |
| `src/lib/whatsapp-employer-flow.ts` | Shared employer-side WhatsApp helper layer; resolves European employer leads vs worker/admin collisions, loads matched employer records, builds employer AI prompts, and supplies deterministic fallback/static replies across the same supported language set so the webhook route does not hardcode employer flow heuristics inline |
| `src/lib/whatsapp-fallback.ts` | Shared config-driven WhatsApp fallback helper; loads platform config and serves multilingual signup/status/payment/documents fallback copy so the webhook route no longer hardcodes the fallback bot block inline, preserves Hindi as Hindi instead of the old Nepali fallback drift, and now honors explicit language-switch requests plus recent conversation language during fallback recovery |
| `src/lib/whatsapp-identity.ts` | Shared WhatsApp identity helper; resolves worker/profile context from direct worker phone matches plus paged auth-phone fallback/backfill via `getAllAuthUsers()` so the webhook route no longer hardcodes that multi-layer lookup inline |
| `src/lib/whatsapp-reply-guardrails.ts` | Shared deterministic WhatsApp guardrails; centralizes escalation/payment/inventory-safe replacement copy plus media-attachment fallback messaging so `src/app/api/whatsapp/webhook/route.ts` no longer hardcodes that copy inline |
| `src/lib/whatsapp-status-events.ts` | Shared Meta delivery-status persistence helper; stores `sent/delivered/failed` plus failure details without keeping status merge logic inline in the webhook route |
| `src/lib/whatsapp-inbound-events.ts` | Shared inbound WhatsApp helper; normalizes phone numbers, extracts text/media content, checks inbound `wamid` dedupe, and records inbound message rows so the webhook route no longer hardcodes that normalize/dedupe/log block inline |
| `src/lib/whatsapp-worker-ai.ts` | Shared worker-side WhatsApp AI helper layer; builds the worker snapshot prompt context, GPT-5 mini intent-router prompt, and GPT-5.4 mini worker reply prompt so the webhook route no longer hardcodes worker AI prompt assembly inline |
| `src/app/api/whatsapp/webhook/route.ts` | Meta webhook: thinner runtime orchestrator around shared GPT-5 mini routing, GPT-5.4 response prompting, identity-resolution helpers, employer-flow helpers, fallback-copy helpers, status-event persistence, conversation loaders, admin commands, guardrails, deterministic worker replies for common status/docs/payment/support/process flows, truthful support auto-handoff, explicit opt-in WhatsApp onboarding with 24h stale-state cleanup plus `cancel/stop/prekini` escape handling, batch-safe inbound processing that no longer aborts later messages in the same Meta payload, and single-response media fallback that avoids pretending WhatsApp attachments already update worker profiles |
| `src/app/api/brain/collect/route.ts` | Brain/ops data collector; aggregates funnel, payment telemetry, auth drift, recent user activity, recent WhatsApp conversations, canonical `whatsappTemplateHealth` + failed-template samples, and a shared `opsSnapshot` so the daily monitor sees real operational signals instead of only top-level counts |
| `src/app/api/brain/improve/route.ts` | Daily low-risk conversation improver; analyzes DB/conversation/error summaries but may only persist safe `common_question / error_fix / copy_rule` learnings after `filterSafeBrainLearnings()` rejects numbers, pricing, country claims, document/legal facts, and URLs |
| `src/app/api/brain/act/route.ts` | Brain action executor; now accepts canonical `update_worker_status` while still honoring legacy `update_candidate_status` during the transition |
| `src/app/api/cron/brain-monitor/route.ts` | Daily ops-first monitor: fetches `/api/brain/collect`, self-tests critical routes, builds a deterministic report via `src/lib/ops-monitor.ts`, stores `ops_daily_snapshot/exception` rows in `brain_reports`, and sends only compact critical/high alert mail with clickable admin links |
| `src/app/api/brain/report/route.ts` | Brain report storage/read API; default model now follows `BRAIN_DAILY_MODEL` |
| `src/lib/brain-monitor.ts` | Shared Brain parsing/normalization helpers; unwraps Responses API JSON, applies safe defaults for partial issue/action/operation payloads, and keeps exception reasoning stable even when the AI omits fields |
| `src/lib/notifications.ts` | Offer notification dispatch helpers; `sendOfferNotification()` / `sendOfferExpiredNotification()` now route through `queueEmail()` + the unified premium template system instead of bypassing the email queue with bespoke inline HTML |
| `src/lib/docx-generator.ts` | DOCX generation from templates (docxtemplater + pizzip) |
| `src/lib/whatsapp.ts` | WhatsApp Cloud API — template sending, text sending, logging; failed sends now persist `error_message` into `whatsapp_messages` so delivery issues are debuggable |
| `src/lib/constants.ts` | Shared constants (industries, countries, etc.) |
| `src/components/messaging/ConversationThread.tsx` | Reusable conversation thread UI used by worker and admin support inboxes |

---

## 6. New Feature Checklist

When adding a new feature, follow this order:

### Step 1: Database
- [ ] Add columns/tables in Supabase (write migration SQL in `supabase/migrations/`)
- [ ] Update RLS policies if needed
- [ ] If adding a new profile field → follow `.agent/workflows/add-profile-field.md`

### Step 2: Backend (API + Lib)
- [ ] Create or update API route in `src/app/api/`
- [ ] Add helper functions in `src/lib/` if needed
- [ ] If the feature sends email → update `src/lib/email-templates.ts` and use `src/lib/mailer.ts`
- [ ] If the feature involves document AI → update `src/lib/document-ai.ts` (and relevant WhatsApp/Brain helper if applicable)

### Step 3: Frontend (UI)
- [ ] Create/update page in `src/app/` (follow App Router conventions)
- [ ] Use `AppShell` for authenticated pages
- [ ] Add navigation links in `AppShell.tsx` sidebar (and mobile bottom nav)
- [ ] Add navigation links in `UnifiedNavbar.tsx` if it's a top-level section

### Step 4: Profile Completion (if applicable)
- [ ] Update completion % logic in the relevant profile page
- [ ] Update admin workers list completion in `src/app/admin/workers/page.tsx`
- [ ] Update cron field maps in `src/app/api/cron/check-incomplete-profiles/route.ts`

### Step 5: Admin (if applicable)
- [ ] Add admin management UI in `src/app/admin/`
- [ ] Add sidebar link in `src/app/admin/layout.tsx` or `AppShell.tsx`

### Step 6: Documentation
- [ ] Update `AGENTS.md` section 5 (Stanje Projekta) and section 6 (Arhitektura)
- [ ] Update `.agent/workflows/project-architecture.md` if architecture changed

### Step 7: Testing & Deploy
- [ ] Test locally with `npm run dev`
- [ ] Verify no TypeScript errors with `npm run typecheck`
- [ ] Verify production build with `npm run build`
- [ ] Check mobile responsiveness
- [ ] Deploy to Vercel

---

## 7. Environment Variables

| Variable | Service | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase (admin) | ✅ |
| `STRIPE_SECRET_KEY` | Stripe | ✅ |
| `STRIPE_WEBHOOK_SECRET` | Stripe | ✅ |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe | ✅ |
| `OPENAI_API_KEY` | OpenAI | ✅ |
| `WHATSAPP_ROUTER_MODEL` | OpenAI | Optional |
| `WHATSAPP_RESPONSE_MODEL` | OpenAI | Optional |
| `BRAIN_DAILY_MODEL` | OpenAI | Optional |
| `GEMINI_API_KEY` | Google Gemini AI fallback | ✅ |
| `SMTP_USER` | Google Workspace email | ✅ |
| `SMTP_PASS` | Google Workspace app password | ✅ |
| `CRON_SECRET` | Vercel cron auth | ✅ |
| `NEXT_PUBLIC_BASE_URL` | App base URL | ✅ |
| `WHATSAPP_TOKEN` | Meta WhatsApp Cloud API | For sending |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta WhatsApp | For sending |
| `WHATSAPP_VERIFY_TOKEN` | Webhook verification | For webhook |
| `META_APP_SECRET` | Meta App Secret | Enables webhook signature verification (`X-Hub-Signature-256`) |
| `OWNER_PHONE` / `OWNER_PHONES` | Admin WhatsApp command auth | Optional, comma-separated phone list |
| `OPENAI_API_KEY` | OpenAI | For WhatsApp router/response models + primary document verification |
| `WHATSAPP_ROUTER_MODEL` | OpenAI | Optional override for WhatsApp intent classifier (`gpt-5-mini` default) |
| `WHATSAPP_RESPONSE_MODEL` | OpenAI | Optional override for WhatsApp response generator (`gpt-5.4-mini` default) |
| `BRAIN_DAILY_MODEL` | OpenAI | Optional override for daily Brain snapshots/exception reports (`gpt-5-mini` default) |

---

## 8. Common Gotchas

### Database Field Naming
- **Always check Supabase column names** before sending data. Example: the column is `experience_years`, NOT `years_experience`. Sending the wrong name causes Supabase to silently reject the entire update.
- **Supabase silent failures** — if you send a field that doesn't exist in the table, the whole upsert can silently fail. Always verify column names match.
- **`activity_log` is gone** — cron/Brain/system telemetry now lives in `user_activity`. Any new monitoring or audit write must target `user_activity`, not the removed legacy table.
- **`contract_data` is not the source of truth for worker/employer/job core fields.** Live Supabase still lacks columns like `worker_full_name`, `employer_company_name`, `job_title`, `salary_rsd`, `start_date`, and `contract_template`. Contract docs must build those values from live relational tables via `src/lib/contract-data.ts`; keep `contract_data` only for supported override/meta fields (`worker_passport_issue_date`, `worker_passport_issuer`, `worker_place_of_birth`, `worker_gender`, `job_description_*`, `end_date`, `signing_date`, `generated_documents`, etc.).
- **Do not use `.single()` on `contract_data` by `match_id`** in contract routes/admin views. Use the shared contract helper instead, so old duplicate rows or partial rows cannot 500 the PDF flow.
- **Do not use raw `.single()` / `.maybeSingle()` on `worker_onboarding` / `workers` when the lookup key is `profile_id` or phone.** Use `src/lib/workers.ts` (`loadCanonicalWorkerRecord()`, `pickCanonicalWorkerRecord()`) so duplicate worker rows cannot break worker pages, Stripe flow, support gating, or WhatsApp identity resolution.
- **Supabase Storage keys must be sanitized before upload.** Camera/device filenames can contain characters like `~` that break uploads with `Invalid key`; route all worker/agency document filenames through `sanitizeStorageFileName()` from `src/lib/workers.ts`.
- **`worker_documents.user_id` must always be a real auth/profile id.** Never point it at `worker_onboarding.id`. Agency draft workers must go through `src/lib/agency-draft-documents.ts`, which stores a hidden auth-backed owner id in `worker_onboarding.application_data.draft_document_owner_profile_id` until claim relinks the documents to the real worker profile.
- **Admin document review must use the live schema.** The canonical fields are `status`, `ocr_json`, `reject_reason`, and `verified_at`. Legacy `verification_result` / `admin_notes` references will break on production because those columns do not exist anymore.
- **Inline admin previews should stay same-origin.** Use `/api/admin/documents/[documentId]/preview` for iframe/PDF rendering instead of direct public storage URLs, otherwise browsers can block the embedded document and force operators into `Open in New Tab`. That same route is now also the one-shot self-heal point for upside-down legacy image documents, so bypassing it skips automatic rotation fixes.
- **Document AI is advisory, not final approval.** `POST /api/verify-document` may reject obviously bad uploads, but successful AI analysis must stop at `manual_review`. Only an explicit admin `verified` decision may count a document toward the all-3-required-docs readiness gate.

### Profile Field Consistency
- When adding/changing a dropdown field (e.g., `preferred_job`), ensure the **same options** are used everywhere: onboarding form, edit form, employer form, admin display.
- **Case sensitivity matters** — `construction` ≠ `Construction`. All dropdown values should be **uppercase first letter** (e.g., `Construction`, `Healthcare`).

### Email Queue
- The `email_queue` table has a CHECK constraint on the `type` column. Only use types that exist in the constraint (e.g., `document_reminder`, `profile_incomplete`). New types must be added to the DB constraint first.
- Invalid-email cleanup is an ops responsibility, not just a mailer concern. Known typo/internal domains (`gmai.com`, `gmial.com`, `yahoo.coms`, `1yahoo.com`, `@workersunited.org`, etc.) should be excluded from reminders/reporting and deleted if the worker has no payments, documents, conversations, or other real business activity.

### WhatsApp Delivery
- `src/lib/whatsapp.ts` must log failed sends with `status = failed` **and** a real `error_message`; otherwise cron metrics will falsely look healthy while templates silently fail.
- `src/app/api/cron/whatsapp-nudge/route.ts` must count `nudged` only when Meta actually returns success. Failed template sends are errors, not nudges.
- Nudge targeting should dedupe workers by canonical profile/phone, otherwise duplicate worker rows will spam the same person and distort operational metrics.

### Stripe Webhook
- The user metadata key is `user_id` (not `userId`). Mismatch causes payment to succeed but post-payment actions to fail silently.
- The webhook handles both `entry_fee` ($9) and `confirmation_fee` ($190) — check the metadata `fee_type` field.
- Confirmation-fee flow is two-stage: worker first moves to `OFFER_PENDING` while the `offers` row stays `pending`; only webhook/`confirm-session` finalization marks the offer `accepted` and increments `positions_filled`.
- Admin revenue/reporting views must filter payments through `src/lib/reporting.ts`. Otherwise synthetic Codex/test rows or orphaned payment records will inflate `$ revenue` and revenue charts.

### Next.js 16 Specifics
- `src/middleware.ts` is deprecated in Next.js 16 → use `src/proxy.ts` (helper remains `src/lib/supabase/middleware.ts`)
- No `config` export in API routes (Pages Router leftover — remove if found)
- `next.config.ts` MUST NOT set `typescript.ignoreBuildErrors = true`. `npm run build` is expected to fail on real TS issues, and `npm run typecheck` is the preflight gate.

### Naming Conventions
- User-facing text: **"worker"** (never "candidate")
- User-facing text: **"Sign In"** (never "Log In")
- Internal DB tables now use `workers` / `worker_documents` for the worker domain
- Agency foundation is live: `supabase/migrations/20260306180000_agency_foundation_scaffold.sql` adds `agencies` plus worker attribution fields on physical `workers`. The migration is applied on live Supabase, and agency flow spans `/profile/agency`, `/profile/agency/workers/new`, `/profile/agency/workers/[id]`, `/api/agency/workers`, `/api/agency/workers/[workerId]/documents`, `/api/agency/claim`, and `/signup?type=worker&claim=...`. The active agency runtime reads/writes through `worker_onboarding` / `worker_documents`, while the schema guard is still kept so preview/local environments fail gracefully if the migration is missing. Generic admin preview now uses the same real agency layout in inspect-only mode without persisting preview data, while `?inspect=<profile_id>` is the real agency inspect path that must never mutate the admin role itself
- `worker_onboarding` / `worker_documents` are the canonical public access surfaces. Do not add new SQL or runtime code against removed `candidates` / `candidate_documents` aliases.
- Date format: **DD/MM/YYYY** — use `toLocaleDateString('en-GB')`, NEVER US format

### Logo
- Official navbar/site logo is the two-part set: `public/logo-icon.png` + `public/logo-wordmark.png`
- Legacy `logo.png` is deprecated in UI routes and should not be used in new code
- Navbar size: icon `h-16 w-16` + wordmark `w-[140px]` (desktop can be slightly wider)
- `logo-full.jpg` is for OG/meta images only, NOT navbar

### Vercel Deployment
- Security headers are in `vercel.json` (X-Frame-Options: DENY, etc.)
- Cron jobs require `CRON_SECRET` Bearer token auth
- All configured cron jobs must stay in `vercel.json` — don't remove them

### AI Document Verification
- **Provider order is intentional** — OpenAI GPT is primary for document vision; Gemini is fallback for resilience, not the source of truth.
- **Prompts must be STRICT** — never say "be lenient" or "accept any". Explicitly list what IS and IS NOT acceptable.
- **Error handlers must be fail-closed** — if AI crashes, return `success: false`, never `success: true`.
- **Wrong document type = rejected** — not `manual_review`. Worker must re-upload the correct document.

### Supabase Auth Pagination
- **`listUsers()` only returns 50 users per page by default.** Always use `getAllAuthUsers()` from `src/lib/supabase/admin.ts` — it loops through all pages with `perPage: 1000`. Without this, admin panels, cron jobs, and announcements silently ignore users beyond page 1.

### Supabase Query Limits
- **`.select()` returns max 1000 rows by default.** If any table could exceed 1000 rows (e.g., `email_queue`, `worker_documents`), use `.range()` or pagination. Never use `.limit()` on cron job queries that must process ALL records.
- **Never add `.limit()` to cron job queries** unless you implement pagination. This silently drops records beyond the limit.

### Stripe Webhook Idempotency
- **Always guard status updates with a precondition check.** Example: `.eq("entry_fee_paid", false)` prevents double webhook delivery from resetting `queue_joined_at`.

### Cron Job Batch Patterns
- **Pre-fetch dedup data in bulk, not per-record.** Use the same pattern as `profile-reminders` and `match-jobs`: fetch all relevant emails into a Set, then do O(1) lookups in the loop. Never query inside a nested loop.
- **Critical alert cooldown matters.** `system-smoke` sends critical emails with a 6-hour cooldown to avoid alert spam loops. Keep the cooldown check when editing alerting logic.
- **Do not write to `brain_memory` with raw inserts in automations.** Use `saveBrainFactsDedup()` from `src/lib/brain-memory.ts` so repeated learnings do not bloat prompts.
- **Do not let `/api/brain/improve` or WhatsApp prompt code invent new business facts from patterns.** Canonical product truths live in `src/lib/whatsapp-brain.ts`; Brain improvement may only add low-risk conversational learnings and must pass `filterSafeBrainLearnings()` before writing to `brain_memory`.

---

## 9. Architecture Update Rule

> **After every significant architectural change, update:**
> 1. `.agent/workflows/project-architecture.md` (this file)
> 2. `AGENTS.md` Section 6 (Arhitektura)
>
> This ensures all documentation reflects the current state of the project.
