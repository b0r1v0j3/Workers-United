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
| Auth | **Supabase Auth** | Email/password, Google OAuth, password reset |
| Database | **Supabase (PostgreSQL)** | RLS policies, cron-triggered functions, in-platform messaging tables (`conversations*`) |
| Storage | **Supabase Storage** | Documents (passport, diploma, biometric photo) |
| Payments | **Stripe** | Checkout Sessions + Webhooks |
| AI | **OpenAI GPT-4o-mini** + **Gemini fallback** | Document verification uses GPT primary vision, with Gemini fallback chain (`3.0-flash → 2.5-pro → 2.5-flash`) |
| AI (Chatbot) | **GPT-4o-mini via n8n** | WhatsApp AI chatbot with memory + enriched user context |
| Email | **Nodemailer** + Google Workspace SMTP | `contact@workersunited.eu` |
| Hosting | **Vercel** | Cron jobs configured in `vercel.json` |
| Icons | **Lucide React** | — |
| WhatsApp | **Meta Cloud API v21.0** | Template messages, AI chatbot, delivery tracking |

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
│   ├── migrations/            # Incremental migrations
│   └── ...                    # Other SQL patches
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Root layout (Montserrat, GodMode, CookieConsent)
│   │   ├── page.tsx           # Homepage (landing page)
│   │   ├── globals.css        # Global styles
│   │   ├── login/             # Login page
│   │   ├── signup/            # Signup page
│   │   ├── profile/
│   │   │   ├── page.tsx       # Auto-redirect (/profile → worker, employer, or agency)
│   │   │   ├── worker/        # Worker workspace in shared AppShell (overview, edit, queue, offers, documents, support inbox); admin can inspect real worker data via `?inspect=<profile_id>` in read-only preview
│   │   │   ├── employer/      # Canonical employer workspace in shared AppShell; `jobs*` routes are legacy redirects back into employer tabs, and admin can inspect real employer workspaces via `?inspect=<profile_id>`
│   │   │   ├── agency/        # Agency dashboard + agency-owned worker detail/editor with near-full worker-profile parity, claim, documents, and payment actions; admin preview stays read-only and can inspect real agency workspaces via `?inspect=<profile_id>`
│   │   │   └── settings/      # GDPR: delete account, export data
│   │   ├── admin/
│   │   │   ├── page.tsx       # Admin operations dashboard (stats, action cards, pipeline, queue watch, inbox, recent lists, role-safety, workspace templates, and direct inspect links into real workspaces)
│   │   │   ├── layout.tsx     # Admin layout (AppShell)
│   │   │   ├── agencies/      # Agency registry with shared admin hero/metrics layout + direct agency workspace inspect links
│   │   │   ├── inbox/         # Admin support inbox (support-thread list + reply workspace)
│   │   │   ├── workers/       # Worker registry + [id] case detail; table now separates inspect-workspace from admin case actions
│   │   │   ├── employers/     # Employer registry with shared admin hero/metrics layout
│   │   │   ├── queue/         # Queue management
│   │   │   ├── jobs/          # Job listings
│   │   │   ├── announcements/ # Bulk email sender
│   │   │   ├── refunds/       # Refund management
│   │   │   └── settings/      # Platform settings
│   │   ├── api/               # API routes (25 total)
│   │   │   ├── account/       # delete, export (GDPR)
│   │   │   ├── admin/         # delete-user, employer-status, funnel-metrics, admin inbox support list
│   │   │   ├── agency/        # agency claim + agency-owned worker APIs (detail patch + document upload)
│   │   │   ├── conversations/ # in-platform messaging APIs (support thread bootstrap + message send/read)
│   │   │   ├── cron/          # 8 cron jobs (see below)
│   │   │   ├── documents/     # verify, verify-passport
│   │   │   ├── contracts/     # prepare, generate (DOCX documents)
│   │   │   ├── stripe/        # create-checkout, webhook, confirm-session fallback
│   │   │   ├── email-queue/   # Email queue processor
│   │   │   ├── godmode/       # Dev testing endpoint
│   │   │   ├── health/        # Health check
│   │   │   ├── offers/        # Job offers
│   │   │   ├── profile/       # Profile API
│   │   │   ├── queue/         # auto-match
│   │   │   ├── signatures/    # Signature storage
│   │   │   ├── whatsapp/      # WhatsApp webhook (Meta → n8n AI bridge)
│   │   │   └── brain/         # AI brain (collect data, self-improve cron)
│   │   ├── auth/              # Auth callback + role selection
│   │   │   ├── callback/     # OAuth/email callback handler + agency draft claim linking
│   │   │   └── select-role/  # Role picker for Google OAuth first-time users
│   │   ├── privacy-policy/    # GDPR privacy policy page
│   │   └── terms/             # Terms & conditions page
│   ├── proxy.ts                # ← CSRF + auth guard (profile, admin, API routes)
│   ├── components/
│   │   ├── AppShell.tsx        # Layout wrapper (sidebar + navbar + content); worker/employer/agency/admin now share it, with role-specific sidebar nav, inspect-query preservation across admin previews, safe routing back to /admin, and no redundant admin sidebar preview links
│   │   ├── UnifiedNavbar.tsx   # Top navigation bar; non-public logo now routes to role dashboard and shows admin-preview badge when relevant
│   │   ├── admin/AdminSectionHero.tsx # Shared admin hero + metrics surface for registry pages
│   │   ├── ContactForm.tsx     # Contact form + AI auto-reply
│   │   ├── CookieConsent.tsx   # GDPR cookie banner
│   │   ├── AgencySetupRequired.tsx # Graceful setup-required card when agency migration is missing
│   │   ├── messaging/         # Shared conversation thread UI
│   │   ├── DocumentWizard.tsx  # Document upload flow
│   │   ├── DocumentGenerator.tsx # Admin: generate 4 DOCX visa docs
│   │   ├── SignaturePad.tsx    # Digital signature component
│   │   ├── DeleteUserButton.tsx # Admin: delete user completely
│   │   ├── EmployerStatusButton.tsx # Admin: change employer status
│   │   ├── GodModePanel.tsx    # Dev testing panel
│   │   └── GodModeWrapper.tsx  # GodMode conditional loader
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts      # Browser Supabase client
│   │   │   ├── server.ts      # Server Supabase client (SSR)
│   │   │   ├── admin.ts       # Service-role Supabase client (bypasses RLS)
│   │   │   └── middleware.ts  # Auth middleware / proxy
│   │   ├── mailer.ts          # sendEmail() via Nodemailer
│   │   ├── email-templates.ts # HTML email templates
│   │   ├── document-ai.ts     # GPT-primary document AI helpers with Gemini fallback
│   │   ├── stripe.ts          # Stripe client initialization
│   │   ├── payment-eligibility.ts # Entry-fee eligibility rules (single source of truth)
│   │   ├── messaging.ts       # Support conversation helpers (access gating, conversation creation, message persistence, summaries)
│   │   ├── brain-memory.ts    # Brain memory dedup + normalization helpers
│   │   ├── notifications.ts   # Email notification helpers
│   │   ├── admin.ts           # Admin utility functions
│   │   ├── constants.ts       # Shared constants
│   │   ├── godmode.ts         # GodMode utilities
│   │   ├── docx-generator.ts  # DOCX generation (docxtemplater + nationality mapping)
│   │   ├── whatsapp.ts        # WhatsApp Cloud API (template sending, logging)
│   │   ├── sanitize.ts        # Input sanitization
│   │   ├── user-management.ts # Shared user deletion logic
│   │   ├── database.types.ts  # Auto-generated Supabase types (npm run db:types)
│   │   └── imageUtils.ts      # Image processing helpers
│   └── types/                 # TypeScript types (currently empty)
├── vercel.json                # Vercel config: security headers + 8 cron jobs
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
| `/api/cron/profile-reminders` | Daily 9 AM UTC | Remind users with incomplete profiles |
| `/api/cron/check-expiring-docs` | Daily 10 AM UTC | Alert when passport expires within 6 months |
| `/api/cron/match-jobs` | Every 6 hours | Auto-match workers to employer job requests |
| `/api/cron/brain-monitor` | Daily 8 AM UTC | System health monitoring |
| `/api/brain/improve` | Daily 3 AM UTC | **AI self-improvement** — scans DB + conversations, generates new brain_memory facts |
| `/api/cron/whatsapp-nudge` | Daily 11 AM UTC | WhatsApp nudges for users who need a profile/doc action |
| `/api/cron/system-smoke` | Every hour at :30 | Route + service smoke monitor (`/`, auth pages, `/api/health`) with critical alert cooldown |

---

## 4. Data Flow

```
User (Browser)
  │
  ├─► Next.js App Router (SSR + Client Components)
  │     ├─► Supabase Auth (login, signup, password reset)
  │     ├─► Supabase Database (profiles, candidates, employers, documents, queue)
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
  └─► Vercel Cron → /api/cron/* (scheduled background jobs)
```

### Authentication Flow
1. User signs up (email/password OR Google OAuth) → Supabase creates auth user
2. For Google OAuth from signup page: `user_type` is passed via URL param and set in metadata
3. For Google OAuth from login page (first time): user is redirected to `/auth/select-role` to choose worker/employer/agency
4. Agency-submitted worker drafts can be claimed via `/signup?type=worker&claim=<candidate-id>`; callback/API links the draft to the real worker auth/profile only when the worker signs up with the same invited email
5. Claimed or draft agency workers can be managed from `/profile/agency/workers/[id]`, where the agency can fill almost the full worker profile (`identity/contact/citizenship/family/preferences/passport`), while keeping `email` and `phone` optional contact channels; the same page also handles document upload/replacement, manual review requests, and the `$9` Job Finder payment for claimed workers
6. Admin access to `/profile/agency` is now read-only preview only: it must never provision an agency row or downgrade the admin role in `profiles`; mutating actions stay available only to actual agency accounts
7. Admin access to `/profile/worker`, `/profile/employer`, and `/profile/agency` is read-only preview only: worker edit/upload/payment, employer save/job posting, and agency draft/doc/payment actions are disabled so the admin account never auto-provisions role-specific data or leaves the admin role; when needed, admin now opens the real target workspace with `?inspect=<profile_id>` instead of overloading the admin's own role records
8. Employer workspace is now canonical at `/profile/employer`; legacy `/profile/employer/jobs` and `/profile/employer/jobs/new` immediately redirect into `?tab=jobs` and `?tab=post-job`
9. On first login → user creates profile in the worker/employer domain (`candidates` remains the legacy physical table for workers)
10. `profiles` table links auth user to their role
11. Proxy (`src/proxy.ts`) checks auth state on protected routes

### Payment Flow
1. Worker completes profile to 100% → gets verified
2. Worker or agency clicks "Pay" → Stripe Checkout Session created (`/api/stripe/create-checkout`)
3. Agency-on-behalf payments target the claimed worker `profile_id`, while metadata preserves the paying agency profile and worker id
4. Stripe redirects back → Webhook confirms payment (`/api/stripe/webhook`)
5. Success redirect includes `session_id`; client can call `/api/stripe/confirm-session` as fallback if webhook is delayed
6. Worker enters queue (`IN_QUEUE` status or preserved advanced status)
7. Successful `$9` unlocks `/profile/worker/inbox`, where the worker can write only to Workers United support
8. Cron job (`match-jobs`) attempts to match with employer requests

### Messaging Flow (Support v1)
1. Supabase migration `20260306234500_messaging_foundation.sql` creates `conversations`, `conversation_participants`, `conversation_messages`, and `conversation_flags`
2. Worker opens `/profile/worker/inbox` after a successful `$9` payment
3. `/api/conversations/support` checks the payment gate and auto-creates a single worker support thread on first access
4. Worker and admin exchange messages through `/api/conversations/[conversationId]/messages`
5. Admin reads and replies from `/admin/inbox`; the admin dashboard and sidebar link there directly
6. Contact information stays hidden; worker/employer direct chat is still future work and must unlock only after `accepted offer + placement fee paid`

---

## 5. Key Files & Their Roles

### Layout & Navigation
| File | Role |
|---|---|
| `src/app/layout.tsx` | Root layout — loads Montserrat font, GodModeWrapper, CookieConsent |
| `src/components/AppShell.tsx` | Authenticated page wrapper — sidebar + navbar with role-specific navigation for worker/employer/agency/admin; admin preview mode shows a clear preview banner, hides account-only actions, preserves `?inspect=` across workspace nav, and routes Dashboard back to `/admin` |
| `src/components/UnifiedNavbar.tsx` | Top navigation bar (logo, links, user menu); dashboard logo routes by role and surfaces `Admin Preview` when admin is viewing worker/employer/agency workspaces |

### Worker Flow
| File | Role |
|---|---|
| `src/app/profile/worker/page.tsx` | Worker profile landing; supports read-only admin inspect of a real worker via `?inspect=<profile_id>` |
| `src/app/profile/worker/DashboardClient.tsx` | Client component for worker profile, payment CTA, and support unlock explanation |
| `src/app/profile/worker/inbox/page.tsx` | Worker support inbox route |
| `src/app/profile/worker/inbox/WorkerInboxClient.tsx` | Worker support inbox client; loads support thread, enforces locked state pre-payment |
| `src/app/profile/worker/edit/` | Single-page profile edit form |
| `src/app/profile/worker/documents/` | Document upload (passport, diploma, photo); also supports read-only admin inspect of the target worker documents |
| `src/app/profile/worker/queue/` | Queue status page; also supports read-only admin inspect of the target worker payment/queue state |
| `src/app/profile/worker/offers/[id]/` | Individual job offer details |

### Employer Flow
| File | Role |
|---|---|
| `src/app/profile/employer/page.tsx` | Canonical employer workspace with tabs for company info, post-job form, and active jobs inside shared `AppShell`; supports read-only admin inspect via `?inspect=<profile_id>` |
| `src/app/profile/employer/jobs/` | Legacy redirect to `/profile/employer?tab=jobs` |
| `src/app/profile/employer/jobs/new/` | Legacy redirect to `/profile/employer?tab=post-job` |

### Admin
| File | Role |
|---|---|
| `src/app/admin/page.tsx` | Admin operations dashboard with actionable stats, queue watch, recent lists, role-safety status, UI preview shortcuts, and direct inspect links into real worker/employer/agency workspaces |
| `src/app/admin/agencies/page.tsx` | Agency operations list with owner metadata, worker counts, and direct workspace inspect links |
| `src/app/admin/inbox/page.tsx` | Admin support inbox page |
| `src/app/admin/inbox/AdminInboxClient.tsx` | Client workspace for selecting and replying to support threads |
| `src/app/admin/workers/page.tsx` | Worker list with filter tabs |
| `src/app/admin/workers/[id]/page.tsx` | Worker detail with document review |
| `src/app/admin/announcements/page.tsx` | Bulk email (Workers / Employers / Everyone) |
| `src/app/admin/settings/page.tsx` | Platform settings |

### Backend (lib)
| File | Role |
|---|---|
| `src/lib/supabase/client.ts` | Browser-side Supabase client |
| `src/lib/supabase/server.ts` | Server-side Supabase client (SSR) |
| `src/lib/supabase/admin.ts` | Service-role clients: legacy `createAdminClient()` + staged `createTypedAdminClient()` for schema-sensitive routes |
| `src/lib/mailer.ts` | `sendEmail()` — Nodemailer wrapper |
| `src/lib/email-templates.ts` | All HTML email templates |
| `src/lib/brain-memory.ts` | Dedupe + normalize helper for `brain_memory` writes |
| `src/lib/smoke-evaluator.ts` | Shared health evaluator (`healthy/degraded/critical`) for smoke checks |
| `src/lib/document-ai.ts` | Shared document AI helpers (OpenAI primary, Gemini fallback) |
| `src/lib/stripe.ts` | Stripe client init |
| `src/lib/payment-eligibility.ts` | Centralized entry-fee eligibility checks used by Stripe checkout API |
| `src/lib/messaging.ts` | Messaging helpers for support access gates, support thread creation, participant access checks, message persistence, and admin summaries |
| `src/lib/contract-data.ts` | Shared contract-doc payload builder; derives full PDF data from live `matches/candidates/profiles/employers/job_requests/candidate_documents` and persists only supported `contract_data` override/meta fields |
| `src/lib/offer-finalization.ts` | Shared confirmation-fee finalization helper; idempotently transitions `offers.pending -> offers.accepted` and increments job capacity once |
| `src/lib/domain.ts` | Canonical role/domain helper; normalizes legacy `candidate` metadata into the `worker` domain and exposes worker storage constants |
| `src/lib/workers.ts` | Shared worker-record provisioning helper; ensures `profiles` + legacy `candidates` rows exist for worker users |
| `src/lib/agencies.ts` | Agency provisioning + ownership helper; schema guard, claim-link context, claim linking, and agency-owned worker resolution over legacy `candidates` |
| `src/lib/notifications.ts` | Email notification dispatch helpers |
| `src/lib/docx-generator.ts` | DOCX generation from templates (docxtemplater + pizzip) |
| `src/lib/whatsapp.ts` | WhatsApp Cloud API — template sending, text sending, logging |
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
| `OPENAI_API_KEY` | OpenAI | For WhatsApp AI chatbot + primary document verification |

---

## 8. Common Gotchas

### Database Field Naming
- **Always check Supabase column names** before sending data. Example: the column is `experience_years`, NOT `years_experience`. Sending the wrong name causes Supabase to silently reject the entire update.
- **Supabase silent failures** — if you send a field that doesn't exist in the table, the whole upsert can silently fail. Always verify column names match.
- **`activity_log` is gone** — cron/Brain/system telemetry now lives in `user_activity`. Any new monitoring or audit write must target `user_activity`, not the removed legacy table.
- **`contract_data` is not the source of truth for worker/employer/job core fields.** Live Supabase still lacks columns like `candidate_full_name`, `employer_company_name`, `job_title`, `salary_rsd`, `start_date`, and `contract_template`. Contract docs must build those values from live relational tables via `src/lib/contract-data.ts`; keep `contract_data` only for supported override/meta fields (`candidate_passport_issue_date`, `job_description_*`, `end_date`, `signing_date`, `generated_documents`, etc.).
- **Do not use `.single()` on `contract_data` by `match_id`** in contract routes/admin views. Use the shared contract helper instead, so old duplicate rows or partial rows cannot 500 the PDF flow.

### Profile Field Consistency
- When adding/changing a dropdown field (e.g., `preferred_job`), ensure the **same options** are used everywhere: onboarding form, edit form, employer form, admin display.
- **Case sensitivity matters** — `construction` ≠ `Construction`. All dropdown values should be **uppercase first letter** (e.g., `Construction`, `Healthcare`).

### Email Queue
- The `email_queue` table has a CHECK constraint on the `type` column. Only use types that exist in the constraint (e.g., `document_reminder`, `profile_incomplete`). New types must be added to the DB constraint first.

### Stripe Webhook
- The user metadata key is `user_id` (not `userId`). Mismatch causes payment to succeed but post-payment actions to fail silently.
- The webhook handles both `entry_fee` ($9) and `confirmation_fee` ($190) — check the metadata `fee_type` field.
- Confirmation-fee flow is two-stage: worker first moves to `OFFER_PENDING` while the `offers` row stays `pending`; only webhook/`confirm-session` finalization marks the offer `accepted` and increments `positions_filled`.

### Next.js 16 Specifics
- `src/middleware.ts` is deprecated in Next.js 16 → use `src/proxy.ts` (helper remains `src/lib/supabase/middleware.ts`)
- No `config` export in API routes (Pages Router leftover — remove if found)
- `next.config.ts` MUST NOT set `typescript.ignoreBuildErrors = true`. `npm run build` is expected to fail on real TS issues, and `npm run typecheck` is the preflight gate.

### Naming Conventions
- User-facing text: **"worker"** (never "candidate")
- User-facing text: **"Sign In"** (never "Log In")
- Internal DB tables still use `candidates` for workers
- Agency foundation is additive-first: `supabase/migrations/20260306180000_agency_foundation_scaffold.sql` adds `agencies` plus worker attribution fields on `candidates`; the migration is now applied on live Supabase, and agency flow spans `/profile/agency`, `/profile/agency/workers/[id]`, `/api/agency/workers`, `/api/agency/workers/[workerId]/documents`, `/api/agency/claim`, and `/signup?type=worker&claim=...`. The schema guard is still kept so preview/local environments fail gracefully if the migration is missing, and admin preview must only show the disabled intake/editor structure without creating data
- Transitional DB aliases are available for gradual migration: `worker_onboarding` (→ `candidates`), `worker_documents` (→ `candidate_documents`), `worker_readiness` (→ `candidate_readiness`)
- Date format: **DD/MM/YYYY** — use `toLocaleDateString('en-GB')`, NEVER US format

### Logo
- Official navbar/site logo is the two-part set: `public/logo-icon.png` + `public/logo-wordmark.png`
- Legacy `logo.png` is deprecated in UI routes and should not be used in new code
- Navbar size: icon `h-16 w-16` + wordmark `w-[140px]` (desktop can be slightly wider)
- `logo-full.jpg` is for OG/meta images only, NOT navbar

### Vercel Deployment
- Security headers are in `vercel.json` (X-Frame-Options: DENY, etc.)
- Cron jobs require `CRON_SECRET` Bearer token auth
- All 5 cron jobs must stay in `vercel.json` — don't remove them

### AI Document Verification
- **Provider order is intentional** — OpenAI GPT is primary for document vision; Gemini is fallback for resilience, not the source of truth.
- **Prompts must be STRICT** — never say "be lenient" or "accept any". Explicitly list what IS and IS NOT acceptable.
- **Error handlers must be fail-closed** — if AI crashes, return `success: false`, never `success: true`.
- **Wrong document type = rejected** — not `manual_review`. Worker must re-upload the correct document.

### Supabase Auth Pagination
- **`listUsers()` only returns 50 users per page by default.** Always use `getAllAuthUsers()` from `src/lib/supabase/admin.ts` — it loops through all pages with `perPage: 1000`. Without this, admin panels, cron jobs, and announcements silently ignore users beyond page 1.

### Supabase Query Limits
- **`.select()` returns max 1000 rows by default.** If any table could exceed 1000 rows (e.g., `email_queue`, `candidate_documents`), use `.range()` or pagination. Never use `.limit()` on cron job queries that must process ALL records.
- **Never add `.limit()` to cron job queries** unless you implement pagination. This silently drops records beyond the limit.

### Stripe Webhook Idempotency
- **Always guard status updates with a precondition check.** Example: `.eq("entry_fee_paid", false)` prevents double webhook delivery from resetting `queue_joined_at`.

### Cron Job Batch Patterns
- **Pre-fetch dedup data in bulk, not per-record.** Use the same pattern as `profile-reminders` and `match-jobs`: fetch all relevant emails into a Set, then do O(1) lookups in the loop. Never query inside a nested loop.
- **Critical alert cooldown matters.** `system-smoke` sends critical emails with a 6-hour cooldown to avoid alert spam loops. Keep the cooldown check when editing alerting logic.
- **Do not write to `brain_memory` with raw inserts in automations.** Use `saveBrainFactsDedup()` from `src/lib/brain-memory.ts` so repeated learnings do not bloat prompts.

---

## 9. Architecture Update Rule

> **After every significant architectural change, update:**
> 1. `.agent/workflows/project-architecture.md` (this file)
> 2. `AGENTS.md` Section 6 (Arhitektura)
>
> This ensures all documentation reflects the current state of the project.
